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

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5-nano';
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
  return { city: '', state: '', ZIPCode: zip.replace(/-.*/, '') };
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

app.post('/api/usps/standardize-line', async (req, res) => {
  try {
    const { addressLine } = req.body || {};
    if (!addressLine || typeof addressLine !== 'string') {
      return res.status(400).json({ error: 'addressLine required' });
    }

    const bearer = await getToken();

    let parsed;
    try {
      parsed = await parseAddressWithLLM(addressLine);
    } catch {
      parsed = zipFallback(addressLine);
    }

    const stateFromLLM = (parsed.state || '').toUpperCase();
    const ZIPCode = (parsed.postal || '').replace(/-.*/, '') || (parsed.ZIPCode || '');

    let streetAddress = composeStreet(parsed).trim();
    if (!streetAddress) streetAddress = deriveStreetFromLine(addressLine);

    let city = parsed.city || '';
    let state = stateFromLLM;
    if ((!city || !state) && ZIPCode) {
      try {
        const cs = await cityStateFromZIP(ZIPCode, bearer);
        city = city || (cs.city || '').toUpperCase();
        state = state || (cs.state || '').toUpperCase();
      } catch { /* ignore */ }
    }

    if (!streetAddress) {
      return res.status(400).json({
        stage: 'address',
        status: 400,
        body: 'streetAddress is empty after parse/fallback'
      });
    }

    const result = await standardizeWithUSPS(
      { streetAddress, city, state, ZIPCode },
      bearer
    );

    return res.json({
      input: { addressLine },
      parsed: { ...parsed, state, postal: parsed.postal || ZIPCode },
      query: { streetAddress, city, state, ZIPCode },
      result
    });
  } catch (e) {
    const payload = typeof e === 'object' ? e : { error: String(e) };
    return res.status(payload.status || 500).json(payload);
  }
});


const PORT = process.env.PORT || 5501;
app.listen(PORT, () => console.log(`USPS+LLM running on http://localhost:${PORT}`));
