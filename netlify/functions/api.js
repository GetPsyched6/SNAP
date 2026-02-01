// Netlify Serverless Function for USPS API + HERE Geocoding + OCR
import OpenAI from 'openai';
import Tesseract from 'tesseract.js';

// HERE API configuration
const HERE_API_KEY = process.env.HERE_API_KEY || '';
const HERE_GEOCODE_BASE = 'https://geocode.search.hereapi.com/v1/geocode';

const ENV = (process.env.USPS_ENV || 'tem').toLowerCase();
const OAUTH_URL = process.env.USPS_OAUTH_URL || (ENV === 'prod'
    ? 'https://apis.usps.com/oauth2/v3/token'
    : 'https://apis-tem.usps.com/oauth2/v3/token');
const ADDR_BASE = process.env.USPS_ADDRESSES_BASE || (ENV === 'prod'
    ? 'https://apis.usps.com/addresses/v3'
    : 'https://apis-tem.usps.com/addresses/v3');

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

async function fetchJSON(url, init) {
    const r = await fetch(url, init);
    const text = await r.text();
    if (!r.ok) {
        const err = new Error(`HTTP ${r.status}`);
        err.status = r.status;
        err.body = text;
        err.url = url;
        throw err;
    }
    return text ? JSON.parse(text) : {};
}

let token = null;
let tokenExp = 0;

async function getToken() {
    const now = Date.now();
    if (token && now < tokenExp - 60_000) return token;
    try {
        const j = await fetchJSON(OAUTH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: process.env.USPS_CLIENT_ID,
                client_secret: process.env.USPS_CLIENT_SECRET,
                grant_type: 'client_credentials'
            })
        });
        token = j.access_token;
        tokenExp = Date.now() + (Number(j.expires_in || 3600) * 1000);
        return token;
    } catch (e) {
        console.error('[USPS OAuth]', e.status, e.body);
        throw { stage: 'oauth', status: e.status, body: e.body };
    }
}

function composeStreet({ number = '', prefix = '', name = '', type = '', suffix = '' }) {
    return [number, prefix, name, type, suffix].filter(Boolean).join(' ').trim();
}

function deriveStreetFromLine(line) {
    const first = (line || '').split('\n')[0];
    const beforeComma = first.split(',')[0].trim();
    return beforeComma;
}

function extractJSON(text) {
    try { return JSON.parse(text); } catch { }
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No JSON found from LLM');
    return JSON.parse(m[0]);
}

function zipFallback(line) {
    const zip = (line.match(/\b\d{5}(?:-\d{4})?\b/) || [''])[0];
    return { city: '', state: '', ZIPCode: zip.replace(/-.*/, ''), _fallback: true };
}

async function parseAddressWithLLM(addressLine) {
    if (!openai) throw new Error('LLM disabled');
    const resp = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
            {
                role: 'system',
                content: 'You parse US addresses into JSON. Return ONLY valid JSON with these fields: number (street number), prefix (N/S/E/W), name (street name), type (St/Ave/Blvd/etc), suffix (NE/SW/etc), city, state (2-letter), postal (ZIP code). Use empty strings for missing fields.'
            },
            {
                role: 'user',
                content: addressLine
            }
        ],
        response_format: { type: 'json_object' }
    });
    const text = resp.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('Empty LLM response');
    return extractJSON(text);
}

async function cityStateFromZIP(ZIPCode, bearer) {
    const url = `${ADDR_BASE}/city-state?ZIPCode=${encodeURIComponent(ZIPCode)}`;
    try {
        return await fetchJSON(url, { headers: { Authorization: `Bearer ${bearer}` } });
    } catch (e) {
        console.error('[USPS city-state]', e.status, e.body);
        throw { stage: 'city-state', status: e.status, body: e.body };
    }
}

async function standardizeWithUSPS({ streetAddress, city, state, ZIPCode }, bearer) {
    const params = new URLSearchParams({
        streetAddress: streetAddress || '',
        city: city || '',
        state: state || '',
        ZIPCode: ZIPCode || ''
    });
    const url = `${ADDR_BASE}/address?${params}`;
    try {
        return await fetchJSON(url, { headers: { Authorization: `Bearer ${bearer}` } });
    } catch (e) {
        console.error('[USPS address]', e.status, e.body);
        throw { stage: 'address', status: e.status, body: e.body, url };
    }
}

// Build query object from parsed fields
function buildQuery(parsed, addressLine) {
    const stateFromLLM = (parsed.state || '').toUpperCase();
    const ZIPCode = (parsed.postal || '').replace(/-.*/, '') || (parsed.ZIPCode || '');
    let streetAddress = composeStreet(parsed).trim();
    if (!streetAddress) streetAddress = deriveStreetFromLine(addressLine);
    const city = (parsed.city || '').toUpperCase();
    const state = stateFromLLM;
    return { streetAddress, city, state, ZIPCode };
}

// =====================================================================
// HERE Geocoding Functions
// =====================================================================

// Classify one HERE item into "exact" / "partial" / "none"
function classifyHereMatch(item) {
    if (!item) return { verdict: 'none', reason: 'no-items' };

    const rt = item.resultType || '';
    const score = item.scoring?.queryScore ?? 0;
    const houseNumberType = item.houseNumberType || '';

    // Interpolated results are approximations, so treat as partial match
    if (houseNumberType === 'interpolated') {
        return { verdict: 'partial', reason: 'houseNumber-interpolated' };
    }

    // Good: houseNumber and high score
    if (rt === 'houseNumber' && score >= 0.9) {
        return { verdict: 'exact', reason: 'houseNumber-high-score' };
    }
    // House, but not super-confident
    if (rt === 'houseNumber') {
        return { verdict: 'partial', reason: 'houseNumber-low-score' };
    }
    // Street-level / intersection-only
    if (rt === 'street' || rt === 'intersection') {
        return { verdict: 'partial', reason: `resultType-${rt}` };
    }
    // Only found locality / admin area
    if (rt === 'locality' || rt === 'administrativeArea') {
        return { verdict: 'partial', reason: `only-${rt}-level` };
    }

    // Fallback
    return { verdict: 'none', reason: `resultType-${rt || 'unknown'}` };
}

// Normalize a HERE item into a smaller object we can show in the UI
function normalizeHereItem(item) {
    if (!item) return null;

    const addr = item.address || {};
    const pos = item.position || {};
    const scoring = item.scoring || {};

    const label =
        addr.label ||
        item.title ||
        [
            addr.houseNumber,
            addr.street,
            addr.district,
            addr.city,
            addr.state,
            addr.postalCode,
            addr.countryName,
        ]
            .filter(Boolean)
            .join(', ');

    const { verdict, reason } = classifyHereMatch(item);

    // Reduce score for interpolated matches to reflect uncertainty
    let adjustedScore = scoring.queryScore ?? null;
    if (item.houseNumberType === 'interpolated' && adjustedScore !== null) {
        adjustedScore = Math.min(adjustedScore, 0.75);
    }

    return {
        verdict,              // "exact" | "partial" | "none"
        reason,               // short explanation string
        matchLevel: item.resultType || null,     // e.g. "houseNumber", "street", "locality"
        queryScore: adjustedScore,  // 0..1 match quality (reduced for interpolated)
        fieldScore: scoring.fieldScore || null,  // optional, per-field scores

        label,                // single-line display address
        address: {
            houseNumber: addr.houseNumber || null,
            street: addr.street || null,
            district: addr.district || null,
            city: addr.city || null,
            county: addr.county || null,
            state: addr.state || null,
            stateCode: addr.stateCode || null,
            postalCode: addr.postalCode || null,
            countryCode: addr.countryCode || null,
            countryName: addr.countryName || null,
        },

        position: {
            lat: typeof pos.lat === 'number' ? pos.lat : null,
            lng: typeof pos.lng === 'number' ? pos.lng : null,
        },

        // Optional: entrances
        access: Array.isArray(item.access)
            ? item.access.map((p) => ({ lat: p.lat, lng: p.lng }))
            : [],
    };
}

// Core HERE call: addressLine -> { raw, items[], best }
async function geocodeWithHere(addressLine, { limit = 1 } = {}) {
    if (!HERE_API_KEY) {
        throw new Error('HERE_API_KEY not configured');
    }

    const q = (addressLine || '').trim();
    if (!q) throw new Error('Empty addressLine');

    const url =
        `${HERE_GEOCODE_BASE}?q=${encodeURIComponent(q)}` +
        `&limit=${encodeURIComponent(limit)}` +
        `&apiKey=${encodeURIComponent(HERE_API_KEY)}`;

    const r = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
    });

    const text = await r.text();
    if (!r.ok) {
        let body;
        try { body = JSON.parse(text); } catch { body = text; }
        const err = new Error(`HERE geocode HTTP ${r.status}`);
        err.status = r.status;
        err.body = body;
        throw err;
    }

    let json;
    try { json = JSON.parse(text); } catch { throw new Error('HERE geocode: invalid JSON'); }

    const items = Array.isArray(json.items) ? json.items : [];
    const first = items[0] || null;

    return {
        raw: json,
        items,
        best: normalizeHereItem(first),
    };
}

export async function handler(event) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Debug: log the incoming request info
    console.log('[API] path:', event.path, 'rawUrl:', event.rawUrl, 'method:', event.httpMethod);

    // Extract path - handle both direct calls and redirected calls
    let path = event.path || '';
    // Remove function prefix if present
    path = path.replace('/.netlify/functions/api', '');
    // Also try removing /api prefix (in case redirect preserves it differently)
    if (path.startsWith('/api/')) {
        path = path.replace('/api', '');
    }

    console.log('[API] normalized path:', path);

    // Original endpoint: parse with AI then call USPS
    if (path === '/usps/standardize-line' && event.httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}');
        const { addressLine } = body;

        if (!addressLine || typeof addressLine !== 'string') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'addressLine required' })
            };
        }

        let bearer;
        try {
            bearer = await getToken();
        } catch (e) {
            return {
                statusCode: e.status || 500,
                headers,
                body: JSON.stringify({ stage: 'oauth', error: e.body || 'OAuth failed' })
            };
        }

        // Parse with AI
        let parsed;
        let aiError = null;
        try {
            parsed = await parseAddressWithLLM(addressLine);
        } catch (err) {
            aiError = err.message || String(err);
            parsed = zipFallback(addressLine);
        }

        // Build query
        let query = buildQuery(parsed, addressLine);

        // Try to enrich city/state from ZIP if missing
        if ((!query.city || !query.state) && query.ZIPCode) {
            try {
                const cs = await cityStateFromZIP(query.ZIPCode, bearer);
                query.city = query.city || (cs.city || '').toUpperCase();
                query.state = query.state || (cs.state || '').toUpperCase();
            } catch { /* ignore */ }
        }

        // Validate streetAddress
        if (!query.streetAddress) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    stage: 'parse',
                    error: 'Could not extract street address',
                    aiError,
                    parsed,
                    query
                })
            };
        }

        // Call USPS
        let uspsError = null;
        let result = null;
        try {
            result = await standardizeWithUSPS(query, bearer);
        } catch (e) {
            uspsError = {
                stage: e.stage || 'address',
                status: e.status,
                body: e.body
            };
        }

        // Always return parsed and query, even on error
        const response = {
            input: { addressLine },
            parsed: {
                number: parsed.number || '',
                prefix: parsed.prefix || '',
                name: parsed.name || '',
                type: parsed.type || '',
                suffix: parsed.suffix || '',
                city: parsed.city || '',
                state: (parsed.state || '').toUpperCase(),
                postal: parsed.postal || parsed.ZIPCode || ''
            },
            query,
            aiError,
            uspsError,
            result
        };

        return {
            statusCode: uspsError ? (uspsError.status || 500) : 200,
            headers,
            body: JSON.stringify(response)
        };
    }

    // Retry endpoint: skip AI parsing, use provided fields directly
    if (path === '/usps/retry' && event.httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}');
        const { streetAddress, city, state, ZIPCode } = body;

        if (!streetAddress) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'streetAddress required' })
            };
        }

        let bearer;
        try {
            bearer = await getToken();
        } catch (e) {
            return {
                statusCode: e.status || 500,
                headers,
                body: JSON.stringify({ stage: 'oauth', error: e.body || 'OAuth failed' })
            };
        }

        const query = {
            streetAddress: streetAddress || '',
            city: (city || '').toUpperCase(),
            state: (state || '').toUpperCase(),
            ZIPCode: ZIPCode || ''
        };

        // Try to enrich city/state from ZIP if missing
        if ((!query.city || !query.state) && query.ZIPCode) {
            try {
                const cs = await cityStateFromZIP(query.ZIPCode, bearer);
                query.city = query.city || (cs.city || '').toUpperCase();
                query.state = query.state || (cs.state || '').toUpperCase();
            } catch { /* ignore */ }
        }

        let uspsError = null;
        let result = null;
        try {
            result = await standardizeWithUSPS(query, bearer);
        } catch (e) {
            uspsError = {
                stage: e.stage || 'address',
                status: e.status,
                body: e.body
            };
        }

        const response = {
            query,
            uspsError,
            result
        };

        return {
            statusCode: uspsError ? (uspsError.status || 500) : 200,
            headers,
            body: JSON.stringify(response)
        };
    }

    // HERE Geocoding endpoint
    if (path === '/here/geocode-line' && event.httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}');
        const { addressLine } = body;

        if (!addressLine || typeof addressLine !== 'string') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'addressLine required' })
            };
        }

        try {
            const data = await geocodeWithHere(addressLine, { limit: 1 });

            if (!data.best) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        input: { addressLine },
                        here: {
                            verdict: 'none',
                            reason: 'no-items',
                            matchLevel: null,
                            queryScore: null,
                            label: null,
                            address: null,
                            position: null,
                            access: [],
                        },
                        raw: data.raw,
                    })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    input: { addressLine },
                    here: data.best,
                    raw: data.raw,
                })
            };
        } catch (err) {
            console.error('[HERE] /api/here/geocode-line error:', err.status, err.body || err.message);

            if (err.status) {
                return {
                    statusCode: err.status,
                    headers,
                    body: JSON.stringify({
                        error: 'here-geocode-failed',
                        status: err.status,
                        body: err.body || null,
                    })
                };
            }

            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'here-geocode-failed', message: String(err.message || err) })
            };
        }
    }

    // OCR endpoint using Tesseract.js
    if (path === '/ocr/extract' && event.httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}');
        const { image } = body;

        if (!image || typeof image !== 'string') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'image (base64) required' })
            };
        }

        try {
            // Extract base64 data (remove data URL prefix if present)
            const base64Data = image.includes(',') ? image.split(',')[1] : image;
            const imageBuffer = Buffer.from(base64Data, 'base64');

            // Run Tesseract OCR
            const result = await Tesseract.recognize(imageBuffer, 'eng', {
                logger: () => { } // Suppress logs
            });

            const data = result.data;

            // Extract lines with confidence scores
            const lines = (data.lines || []).map(line => ({
                text: line.text.trim(),
                confidence: Math.round(line.confidence * 10) / 10
            })).filter(l => l.text.length > 0);

            // Calculate overall confidence
            const overallConfidence = lines.length > 0
                ? Math.round((lines.reduce((sum, l) => sum + l.confidence, 0) / lines.length) * 10) / 10
                : 0;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    text: data.text.trim(),
                    lines,
                    overallConfidence
                })
            };
        } catch (err) {
            console.error('[OCR] error:', err.message || err);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'ocr-failed', message: String(err.message || err) })
            };
        }
    }

    // Debug: return info about what we received
    return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
            error: 'Not found',
            debug: {
                receivedPath: event.path,
                normalizedPath: path,
                method: event.httpMethod,
                rawUrl: event.rawUrl
            }
        })
    };
}
