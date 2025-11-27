// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 5501;
app.listen(PORT, () => console.log(`USPS+LLM running on http://localhost:${PORT}`));
