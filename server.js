// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import Tesseract from 'tesseract.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// HERE API configuration
const HERE_API_KEY = process.env.HERE_API_KEY || '';
const HERE_GEOCODE_BASE = 'https://geocode.search.hereapi.com/v1/geocode';

if (!HERE_API_KEY) {
  console.warn('[HERE] WARNING: HERE_API_KEY is not set. Geocoding will fail.');
}

// Google Maps Geocoding API configuration
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const GOOGLE_GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';

if (!GOOGLE_MAPS_API_KEY) {
  console.warn('[GOOGLE] WARNING: GOOGLE_MAPS_API_KEY is not set. Geocoding will fail.');
}

// Azure Maps API configuration
const AZURE_MAPS_API_KEY = process.env.AZURE_MAPS_API_KEY || '';
const AZURE_GEOCODE_BASE = 'https://atlas.microsoft.com/search/address/json';

if (!AZURE_MAPS_API_KEY) {
  console.warn('[AZURE] WARNING: AZURE_MAPS_API_KEY is not set. Geocoding will fail.');
}

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

// =====================================================================
// Google Maps Geocoding Functions
// =====================================================================

// Classify a Google geocoding result into "exact" / "partial" / "none"
function classifyGoogleMatch(result) {
  if (!result) return { verdict: 'none', reason: 'no-results' };

  const locationType = result.geometry?.location_type || '';
  const types = result.types || [];

  if (locationType === 'ROOFTOP') {
    return { verdict: 'exact', reason: 'rooftop' };
  }
  if (locationType === 'RANGE_INTERPOLATED') {
    return { verdict: 'partial', reason: 'range-interpolated' };
  }
  if (locationType === 'GEOMETRIC_CENTER') {
    return { verdict: 'partial', reason: 'geometric-center' };
  }
  if (locationType === 'APPROXIMATE') {
    if (types.includes('locality') || types.includes('postal_code')) {
      return { verdict: 'partial', reason: 'approximate-locality' };
    }
    return { verdict: 'none', reason: 'approximate' };
  }

  return { verdict: 'none', reason: `unknown-location-type-${locationType || 'missing'}` };
}

// Extract an address component by type from Google's address_components array
function getGoogleComponent(components, type) {
  const comp = (components || []).find(c => (c.types || []).includes(type));
  return comp || null;
}

// Compute a 0-1 confidence score based on Google response fields
function computeGoogleScore(result) {
  if (!result) return 0;

  const locationType = result.geometry?.location_type || '';
  const types = result.types || [];
  const comps = result.address_components || [];
  const partialMatch = result.partial_match === true;

  // Base score from location_type
  let score = 0;
  if (locationType === 'ROOFTOP') score = 0.95;
  else if (locationType === 'RANGE_INTERPOLATED') score = 0.70;
  else if (locationType === 'GEOMETRIC_CENTER') score = 0.50;
  else if (locationType === 'APPROXIMATE') score = 0.25;
  else score = 0.10;

  // Bonus for address component completeness (max +0.05)
  const hasStreetNumber = comps.some(c => c.types?.includes('street_number'));
  const hasRoute = comps.some(c => c.types?.includes('route'));
  const hasLocality = comps.some(c => c.types?.includes('locality'));
  const hasPostalCode = comps.some(c => c.types?.includes('postal_code'));
  const completeness = [hasStreetNumber, hasRoute, hasLocality, hasPostalCode].filter(Boolean).length;
  score += completeness * 0.0125; // max +0.05

  // Penalty for partial_match
  if (partialMatch) score -= 0.15;

  // Bonus if result type is street_address (most specific)
  if (types.includes('street_address')) score += 0.02;
  if (types.includes('premise')) score += 0.02;

  return Math.max(0, Math.min(1, score));
}

// Normalize a Google geocoding result into a consistent structure
function normalizeGoogleResult(result) {
  if (!result) return null;

  const geo = result.geometry || {};
  const loc = geo.location || {};
  const comps = result.address_components || [];

  const { verdict, reason } = classifyGoogleMatch(result);

  const streetNumber = getGoogleComponent(comps, 'street_number');
  const route = getGoogleComponent(comps, 'route');
  const locality = getGoogleComponent(comps, 'locality');
  const county = getGoogleComponent(comps, 'administrative_area_level_2');
  const state = getGoogleComponent(comps, 'administrative_area_level_1');
  const country = getGoogleComponent(comps, 'country');
  const postalCode = getGoogleComponent(comps, 'postal_code');

  return {
    verdict,
    reason,
    locationType: geo.location_type || null,
    placeId: result.place_id || null,
    types: result.types || [],
    partialMatch: result.partial_match === true,
    confidenceScore: computeGoogleScore(result),

    label: result.formatted_address || null,
    address: {
      houseNumber: streetNumber?.short_name || null,
      street: route?.short_name || null,
      city: locality?.long_name || null,
      county: county?.long_name || null,
      state: state?.long_name || null,
      stateCode: state?.short_name || null,
      postalCode: postalCode?.short_name || null,
      countryCode: country?.short_name || null,
      countryName: country?.long_name || null,
    },

    position: {
      lat: typeof loc.lat === 'number' ? loc.lat : null,
      lng: typeof loc.lng === 'number' ? loc.lng : null,
    },
  };
}

// Core Google call: addressLine -> { raw, results[], best }
async function geocodeWithGoogle(addressLine, { limit = 1 } = {}) {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY not configured');
  }

  const q = (addressLine || '').trim();
  if (!q) throw new Error('Empty addressLine');

  const url =
    `${GOOGLE_GEOCODE_BASE}?address=${encodeURIComponent(q)}` +
    `&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;

  const r = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  const text = await r.text();
  if (!r.ok) {
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    const err = new Error(`Google geocode HTTP ${r.status}`);
    err.status = r.status;
    err.body = body;
    throw err;
  }

  let json;
  try { json = JSON.parse(text); } catch { throw new Error('Google geocode: invalid JSON'); }

  // Google returns a status field at the top level
  if (json.status && json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
    const err = new Error(`Google geocode status: ${json.status}`);
    err.status = json.status === 'REQUEST_DENIED' ? 403 : 400;
    err.body = json;
    throw err;
  }

  const results = Array.isArray(json.results) ? json.results.slice(0, limit) : [];
  const first = results[0] || null;

  return {
    raw: json,
    results,
    best: normalizeGoogleResult(first),
  };
}

// =====================================================================
// Azure Maps Geocoding Functions
// =====================================================================

// Classify an Azure Maps result into "exact" / "partial" / "none"
function classifyAzureMatch(result) {
  if (!result) return { verdict: 'none', reason: 'no-results' };

  const type = result.type || '';

  if (type === 'Point Address') {
    return { verdict: 'exact', reason: 'point-address' };
  }
  if (type === 'Address Range') {
    return { verdict: 'partial', reason: 'address-range' };
  }
  if (type === 'Street' || type === 'Cross Street') {
    return { verdict: 'partial', reason: `type-${type.toLowerCase().replace(' ', '-')}` };
  }
  if (type === 'Geography') {
    return { verdict: 'partial', reason: 'geography-only' };
  }
  if (type === 'POI') {
    return { verdict: 'partial', reason: 'poi' };
  }

  return { verdict: 'none', reason: `unknown-type-${type || 'missing'}` };
}

// Compute a 0-1 confidence score based on Azure response fields
function computeAzureScore(result) {
  if (!result) return 0;

  const type = result.type || '';
  const rawScore = result.score ?? 0;
  const addr = result.address || {};

  // Base: normalize Azure's score (typically 1-15+) to 0-1 range
  let score = Math.min(rawScore / 15, 1.0) * 0.6; // Azure score contributes up to 60%

  // Type-based bonus (up to +0.30)
  if (type === 'Point Address') score += 0.30;
  else if (type === 'Address Range') score += 0.15;
  else if (type === 'Street' || type === 'Cross Street') score += 0.08;
  else if (type === 'Geography') score += 0.03;
  else if (type === 'POI') score += 0.05;

  // Address completeness bonus (max +0.08)
  const fields = [addr.streetNumber, addr.streetName, addr.municipality, addr.postalCode];
  const completeness = fields.filter(Boolean).length;
  score += completeness * 0.02;

  // Entry points bonus (indicates precise building-level data)
  if (Array.isArray(result.entryPoints) && result.entryPoints.length > 0) {
    score += 0.02;
  }

  return Math.max(0, Math.min(1, score));
}

// Normalize an Azure Maps result into a consistent structure
function normalizeAzureResult(result) {
  if (!result) return null;

  const addr = result.address || {};
  const pos = result.position || {};

  const { verdict, reason } = classifyAzureMatch(result);

  return {
    verdict,
    reason,
    resultType: result.type || null,
    score: result.score ?? null,
    confidenceScore: computeAzureScore(result),
    id: result.id || null,

    label: addr.freeformAddress || null,
    address: {
      houseNumber: addr.streetNumber || null,
      street: addr.streetName || null,
      city: addr.municipality || null,
      county: addr.countrySecondarySubdivision || null,
      state: addr.countrySubdivisionName || null,
      stateCode: addr.countrySubdivisionCode || null,
      postalCode: addr.postalCode || null,
      countryCode: addr.countryCode || null,
      countryName: addr.country || null,
    },

    position: {
      lat: typeof pos.lat === 'number' ? pos.lat : null,
      lng: typeof pos.lon === 'number' ? pos.lon : null,
    },

    entryPoints: Array.isArray(result.entryPoints)
      ? result.entryPoints.map(ep => ({ type: ep.type, lat: ep.position?.lat, lng: ep.position?.lon }))
      : [],
  };
}

// Core Azure call: addressLine -> { raw, results[], best }
async function geocodeWithAzure(addressLine, { limit = 1 } = {}) {
  if (!AZURE_MAPS_API_KEY) {
    throw new Error('AZURE_MAPS_API_KEY not configured');
  }

  const q = (addressLine || '').trim();
  if (!q) throw new Error('Empty addressLine');

  const url =
    `${AZURE_GEOCODE_BASE}?api-version=1.0` +
    `&query=${encodeURIComponent(q)}` +
    `&limit=${encodeURIComponent(limit)}` +
    `&subscription-key=${encodeURIComponent(AZURE_MAPS_API_KEY)}`;

  const r = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  const text = await r.text();
  if (!r.ok) {
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    const err = new Error(`Azure Maps geocode HTTP ${r.status}`);
    err.status = r.status;
    err.body = body;
    throw err;
  }

  let json;
  try { json = JSON.parse(text); } catch { throw new Error('Azure Maps geocode: invalid JSON'); }

  const results = Array.isArray(json.results) ? json.results.slice(0, limit) : [];
  const first = results[0] || null;

  return {
    raw: json,
    results,
    best: normalizeAzureResult(first),
  };
}

// Original endpoint: parse with AI then call USPS
app.post('/api/usps/standardize-line', async (req, res) => {
  try {
    const { addressLine } = req.body || {};
    if (!addressLine || typeof addressLine !== 'string') {
      return res.status(400).json({ error: 'addressLine required' });
    }

    let bearer;
    try {
      bearer = await getToken();
    } catch (e) {
      return res.status(e.status || 500).json({ stage: 'oauth', error: e.body || 'OAuth failed' });
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
      return res.status(400).json({
        stage: 'parse',
        error: 'Could not extract street address',
        aiError,
        parsed,
        query
      });
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

    return res.status(uspsError ? (uspsError.status || 500) : 200).json(response);
  } catch (e) {
    const payload = typeof e === 'object' ? e : { error: String(e) };
    return res.status(payload.status || 500).json(payload);
  }
});

// Retry endpoint: skip AI parsing, use provided fields directly
app.post('/api/usps/retry', async (req, res) => {
  try {
    const { streetAddress, city, state, ZIPCode } = req.body || {};

    if (!streetAddress) {
      return res.status(400).json({ error: 'streetAddress required' });
    }

    let bearer;
    try {
      bearer = await getToken();
    } catch (e) {
      return res.status(e.status || 500).json({ stage: 'oauth', error: e.body || 'OAuth failed' });
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

    return res.status(uspsError ? (uspsError.status || 500) : 200).json(response);
  } catch (e) {
    const payload = typeof e === 'object' ? e : { error: String(e) };
    return res.status(payload.status || 500).json(payload);
  }
});

// =====================================================================
// HERE Geocoding Endpoint
// =====================================================================
app.post('/api/here/geocode-line', async (req, res) => {
  try {
    const { addressLine } = req.body || {};
    if (!addressLine || typeof addressLine !== 'string') {
      return res.status(400).json({ error: 'addressLine required' });
    }

    const data = await geocodeWithHere(addressLine, { limit: 1 });

    if (!data.best) {
      return res.json({
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
      });
    }

    return res.json({
      input: { addressLine },
      here: data.best,
      raw: data.raw,
    });
  } catch (err) {
    console.error('[HERE] /api/here/geocode-line error:', err.status, err.body || err.message);

    if (err.status) {
      return res
        .status(err.status)
        .json({
          error: 'here-geocode-failed',
          status: err.status,
          body: err.body || null,
        });
    }

    return res
      .status(500)
      .json({ error: 'here-geocode-failed', message: String(err.message || err) });
  }
});

// =====================================================================
// Google Maps Geocoding Endpoint
// =====================================================================
app.post('/api/google/geocode-line', async (req, res) => {
  try {
    const { addressLine } = req.body || {};
    if (!addressLine || typeof addressLine !== 'string') {
      return res.status(400).json({ error: 'addressLine required' });
    }

    const data = await geocodeWithGoogle(addressLine, { limit: 1 });

    if (!data.best) {
      return res.json({
        input: { addressLine },
        google: {
          verdict: 'none',
          reason: 'no-results',
          locationType: null,
          label: null,
          address: null,
          position: null,
        },
        raw: data.raw,
      });
    }

    return res.json({
      input: { addressLine },
      google: data.best,
      raw: data.raw,
    });
  } catch (err) {
    console.error('[GOOGLE] /api/google/geocode-line error:', err.status, err.body || err.message);

    if (err.status) {
      return res
        .status(typeof err.status === 'number' ? err.status : 500)
        .json({
          error: 'google-geocode-failed',
          status: err.status,
          body: err.body || null,
        });
    }

    return res
      .status(500)
      .json({ error: 'google-geocode-failed', message: String(err.message || err) });
  }
});

// =====================================================================
// Azure Maps Geocoding Endpoint
// =====================================================================
app.post('/api/azure/geocode-line', async (req, res) => {
  try {
    const { addressLine } = req.body || {};
    if (!addressLine || typeof addressLine !== 'string') {
      return res.status(400).json({ error: 'addressLine required' });
    }

    const data = await geocodeWithAzure(addressLine, { limit: 1 });

    if (!data.best) {
      return res.json({
        input: { addressLine },
        azure: {
          verdict: 'none',
          reason: 'no-results',
          resultType: null,
          score: null,
          label: null,
          address: null,
          position: null,
          entryPoints: [],
        },
        raw: data.raw,
      });
    }

    return res.json({
      input: { addressLine },
      azure: data.best,
      raw: data.raw,
    });
  } catch (err) {
    console.error('[AZURE] /api/azure/geocode-line error:', err.status, err.body || err.message);

    if (err.status) {
      return res
        .status(typeof err.status === 'number' ? err.status : 500)
        .json({
          error: 'azure-geocode-failed',
          status: err.status,
          body: err.body || null,
        });
    }

    return res
      .status(500)
      .json({ error: 'azure-geocode-failed', message: String(err.message || err) });
  }
});

// =====================================================================
// OCR Endpoint using Tesseract.js
// =====================================================================
app.post('/api/ocr/extract', async (req, res) => {
  try {
    const { image } = req.body || {};

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'image (base64) required' });
    }

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

    return res.json({
      text: data.text.trim(),
      lines,
      overallConfidence
    });
  } catch (err) {
    console.error('[OCR] error:', err.message || err);
    return res.status(500).json({ error: 'ocr-failed', message: String(err.message || err) });
  }
});

// Serve static files (HTML, CSS, JS, assets)
app.use(express.static('.'));

const PORT = process.env.PORT || 5501;
app.listen(PORT, () => console.log(`USPS+LLM+HERE running on http://localhost:${PORT}`));
