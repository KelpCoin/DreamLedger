'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.WANTED_DATA_DIR || path.join(ROOT, 'data', 'wanted');
const CANDIDATE_FILE = path.join(DATA_DIR, 'candidate-items.jsonl');
const SESSION_FILE = path.join(DATA_DIR, 'hunt-sessions.jsonl');

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CANDIDATE_FILE)) fs.writeFileSync(CANDIDATE_FILE, '', 'utf8');
  if (!fs.existsSync(SESSION_FILE)) fs.writeFileSync(SESSION_FILE, '', 'utf8');
}

function appendJsonl(file, value) {
  ensureStore();
  fs.appendFileSync(file, JSON.stringify(value) + '\n', 'utf8');
}

function readJsonl(file) {
  ensureStore();
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function requestJson(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: { 'User-Agent': 'DreamLedger-WANTED/1.0', Accept: 'application/json', ...(options.headers || {}) },
      timeout: Number(options.timeout || 15000)
    }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        data += chunk;
        if (data.length > 4000000) req.destroy(new Error('Response too large'));
      });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const detail = data.slice(0, 500).replace(/\s+/g, ' ');
          return reject(new Error('HTTP ' + res.statusCode + (detail ? ': ' + detail : '')));
        }
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON response')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Request timeout')));
    if (body != null) req.write(body);
    req.end();
  });
}

function requestText(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: { 'User-Agent': 'DreamLedger-WANTED/1.0', ...(options.headers || {}) },
      timeout: Number(options.timeout || 15000)
    }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        data += chunk;
        if (data.length > 1000000) req.destroy(new Error('Response too large'));
      });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const detail = data.slice(0, 500).replace(/\s+/g, ' ');
          return reject(new Error('HTTP ' + res.statusCode + (detail ? ': ' + detail : '')));
        }
        resolve(data);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Request timeout')));
    if (body != null) req.write(body);
    req.end();
  });
}

async function getEbayApplicationToken(clientId, clientSecret) {
  if (!clientId || !clientSecret) return null;
  const body = 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope');
  const basic = Buffer.from(clientId + ':' + clientSecret).toString('base64');
  const data = await requestJson('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + basic,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }, body);
  if (!data.access_token) throw new Error('eBay token response did not contain access_token');
  return data.access_token;
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map(v => String(v).trim()).filter(Boolean))];
}

function fieldValues(wanted, field) {
  return String(wanted[field] || '').split(/[,|/]+/).map(v => v.trim()).filter(Boolean);
}

function buildEbayQuery(wanted) {
  return unique([
    wanted.brand,
    wanted.category,
    wanted.style,
    ...fieldValues(wanted, 'colour'),
    ...fieldValues(wanted, 'size'),
    wanted.era
  ]).join(' ').trim();
}

function buildEbayFilter(wanted) {
  const filters = ['buyingOptions:{FIXED_PRICE}'];
  if (wanted.max_price != null && Number.isFinite(Number(wanted.max_price))) {
    filters.push('price:[0..' + Number(wanted.max_price) + ']');
  }
  return filters.join(',');
}

function normaliseCandidate(item) {
  return {
    platform: 'ebay',
    product_id: item.itemId || null,
    title: item.title || null,
    price: item.price && Number(item.price.value),
    currency: item.price && item.price.currency || null,
    product_url: item.itemWebUrl || null,
    image_url: item.image && item.image.imageUrl || null,
    condition: item.condition || item.conditionId || null,
    seller: item.seller && (item.seller.username || item.seller.feedbackPercentage) || null,
    shipping: item.shippingOptions && item.shippingOptions[0] && item.shippingOptions[0].shippingCost
      ? Number(item.shippingOptions[0].shippingCost.value)
      : null,
    source: 'eBay Browse API'
  };
}

async function searchEbay(wanted, options = {}) {
  const token = options.token || process.env.EBAY_OAUTH_TOKEN;
  let applicationToken = token;
  if (!applicationToken && process.env.EBAY_APP_ID && process.env.EBAY_CERT_ID) {
    applicationToken = await getEbayApplicationToken(process.env.EBAY_APP_ID, process.env.EBAY_CERT_ID);
  }
  if (!applicationToken) return { platform: 'ebay', status: 'NOT_CONFIGURED', candidates: [], query: buildEbayQuery(wanted) };

  const params = new URLSearchParams();
  params.set('q', buildEbayQuery(wanted) || 'item');
  params.set('limit', String(Math.min(Math.max(Number(options.limit || 50), 1), 200)));
  params.set('sort', 'BEST_MATCH');
  params.set('filter', buildEbayFilter(wanted));

  const marketplace = process.env.EBAY_MARKETPLACE_ID || 'EBAY_AU';
  const data = await requestJson('https://api.ebay.com/buy/browse/v1/item_summary/search?' + params.toString(), {
    headers: {
      Authorization: 'Bearer ' + applicationToken,
      'X-EBAY-C-MARKETPLACE-ID': marketplace,
      'Accept-Language': 'en-NZ'
    }
  });

  return {
    platform: 'ebay',
    status: 'OK',
    marketplace,
    query: params.get('q'),
    candidates: (data.itemSummaries || []).map(normaliseCandidate),
    total: Number(data.total || 0)
  };
}

function normaliseText(value) {
  return String(value || '').toLowerCase();
}

function containsAny(haystack, needles) {
  const text = normaliseText(haystack);
  return needles.length > 0 && needles.some(n => text.includes(normaliseText(n)));
}

function scoreField(candidateTitle, wantedValue, weight) {
  const values = fieldValues({ value: wantedValue }, 'value');
  if (!values.length) return { score: null, weight: 0 };
  return { score: containsAny(candidateTitle, values) ? 1 : 0, weight };
}

function priceScore(candidate, wanted) {
  if (wanted.max_price == null || !Number.isFinite(Number(wanted.max_price))) return { score: null, weight: 0 };
  if (candidate.price == null || !Number.isFinite(Number(candidate.price))) return { score: 0, weight: 0.15 };
  const max = Number(wanted.max_price);
  if (candidate.currency && wanted.currency && candidate.currency !== wanted.currency) return { score: 0, weight: 0.05 };
  if (candidate.price > max) return { score: 0, weight: 0.15 };
  return { score: Math.max(0, Math.min(1, 1 - (candidate.price / Math.max(max, 0.01)) * 0.35)), weight: 0.15 };
}

function rankCandidate(candidate, wanted) {
  const title = candidate.title || '';
  const parts = [
    ['brand', wanted.brand, 0.30],
    ['size', wanted.size, 0.20],
    ['colour', wanted.colour, 0.15],
    ['era', wanted.era, 0.15],
    ['style', wanted.style, 0.05]
  ];
  const scores = {};
  let numerator = 0;
  let denominator = 0;
  for (const [name, value, weight] of parts) {
    const result = scoreField(title, value, weight);
    if (result.weight) {
      scores[name] = result.score;
      numerator += result.score * result.weight;
      denominator += result.weight;
    }
  }
  const p = priceScore(candidate, wanted);
  if (p.weight) {
    scores.price = p.score;
    numerator += p.score * p.weight;
    denominator += p.weight;
  }
  const total = denominator ? numerator / denominator : 0;
  return {
    ...candidate,
    scores,
    match_score: Number(total.toFixed(4)),
    verdict: total >= 0.80 ? 'STRONG' : total >= 0.60 ? 'POSSIBLE' : 'WEAK'
  };
}

function rankCandidates(candidates, wanted) {
  return candidates.map(c => rankCandidate(c, wanted)).sort((a, b) => b.match_score - a.match_score);
}

function loadWanted(wantedId) {
  const file = path.join(DATA_DIR, 'wanted-items.jsonl');
  const items = readJsonl(file);
  return items.find(item => item.id === wantedId) || null;
}

async function hunt(wanted, options = {}) {
  if (!wanted || typeof wanted !== 'object') throw new Error('wanted object is required');
  const wantedId = wanted.id || options.wantedId || null;
  const started = new Date().toISOString();
  const adapters = [];
  let rawCandidates = [];

  try {
    const ebay = await searchEbay(wanted, options.ebay || {});
    adapters.push(ebay);
    rawCandidates = rawCandidates.concat(ebay.candidates || []);
  } catch (error) {
    adapters.push({ platform: 'ebay', status: 'ERROR', candidates: [], error: error.message });
  }

  const ranked = rankCandidates(rawCandidates, wanted).map(candidate => ({
    ...candidate,
    wanted_id: wantedId,
    discovered_at: new Date().toISOString()
  }));
  for (const candidate of ranked) appendJsonl(CANDIDATE_FILE, candidate);

  const session = {
    id: 'H-' + Date.now().toString(36),
    wanted_id: wantedId,
    started_at: started,
    completed_at: new Date().toISOString(),
    candidate_count: ranked.length,
    best_match_score: ranked.length ? ranked[0].match_score : 0,
    adapters
  };
  appendJsonl(SESSION_FILE, session);

  return { status: 'COMPLETE', wanted, adapters, candidates: ranked, session };
}

module.exports = {
  CANDIDATE_FILE,
  SESSION_FILE,
  buildEbayQuery,
  buildEbayFilter,
  getEbayApplicationToken,
  searchEbay,
  rankCandidate,
  rankCandidates,
  loadWanted,
  hunt,
  readJsonl
};
