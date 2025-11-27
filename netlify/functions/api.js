// Netlify Serverless Function for USPS API
import OpenAI from 'openai';

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
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      number: { type: 'string' }, prefix: { type: 'string' }, name: { type: 'string' }, type: { type: 'string' }, suffix: { type: 'string' },
      city: { type: 'string' }, state: { type: 'string' }, postal: { type: 'string' }
    },
    required: ['name']
  };
  const resp = await openai.responses.create({
    model: OPENAI_MODEL,
    input: `Parse this US address into fields (JSON only): number, prefix, name, type, suffix, city, state (2-letter), postal.\nLine: ${addressLine}`,
    text_format: { type: 'json_schema', json_schema: { name: 'AddressFields', schema, strict: true } },
    temperature: 0
  });
  const text = resp.output_text ?? resp.output?.[0]?.content?.[0]?.text ?? '';
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
