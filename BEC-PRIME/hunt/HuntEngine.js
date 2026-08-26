'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.WANTED_DATA_DIR || path.join(ROOT, 'data', 'wanted');
const PROOF_DIR = process.env.INVERSE_PROOF_DIR || 'D:\\BrownEyeCortex\\InverseShopping\\proof';
const CANDIDATE_FILE = path.join(DATA_DIR, 'candidate-items.jsonl');
const SESSION_FILE = path.join(DATA_DIR, 'hunt-sessions.jsonl');

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CANDIDATE_FILE)) fs.writeFileSync(CANDIDATE_FILE, '', 'utf8');
  if (!fs.existsSync(SESSION_FILE)) fs.writeFileSync(SESSION_FILE, '', 'utf8');
}
function appendJsonl(file, value) { ensureStore(); fs.appendFileSync(file, JSON.stringify(value) + '\n', 'utf8'); }
function readJsonl(file) {
  ensureStore();
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
}
function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }

function requestJson(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: { 'User-Agent': 'DreamLedger-WANTED/1.1', Accept: 'application/json', ...(options.headers || {}) },
      timeout: Number(options.timeout || 15000)
    }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        data += chunk;
        if (data.length > 4000000) req.destroy(new Error('Response too large'));
      });
      res.on('end', () => {
        const meta = { statusCode: res.statusCode, durationMs: Date.now() - started, raw: data, headers: res.headers };
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const detail = data.slice(0, 500).replace(/\s+/g, ' ');
          const err = new Error('HTTP ' + res.statusCode + (detail ? ': ' + detail : ''));
          err.meta = meta;
          return reject(err);
        }
        try { resolve({ data: JSON.parse(data), ...meta }); }
        catch { const err = new Error('Invalid JSON response'); err.meta = meta; reject(err); }
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
  const result = await requestJson('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded' }
  }, body);
  if (!result.data.access_token) throw new Error('eBay token response did not contain access_token');
  return result.data.access_token;
}
function unique(values) { return [...new Set(values.filter(Boolean).map(v => String(v).trim()).filter(Boolean))]; }
function fieldValues(wanted, field) { return String(wanted[field] || '').split(/[,|/]+/).map(v => v.trim()).filter(Boolean); }
function buildEbayQuery(wanted) { return unique([wanted.brand, wanted.category, wanted.style, ...fieldValues(wanted, 'colour'), ...fieldValues(wanted, 'size'), wanted.era]).join(' ').trim(); }
function buildEbayFilter(wanted, marketplaceCurrency = (process.env.EBAY_PRICE_CURRENCY || 'AUD')) {
  const filters = ['buyingOptions:{FIXED_PRICE}', 'deliveryCountry:NZ'];
  if (wanted.max_price != null && Number.isFinite(Number(wanted.max_price)) && String(wanted.currency || '').toUpperCase() === String(marketplaceCurrency).toUpperCase()) {
    filters.push('price:[..' + Number(wanted.max_price) + ']', 'priceCurrency:' + marketplaceCurrency);
  }
  return filters.join(',');
}
function normaliseCandidate(item) {
  const shipping = item.shippingOptions && item.shippingOptions[0] && item.shippingOptions[0].shippingCost;
  return {
    platform: 'ebay',
    product_id: item.itemId || null,
    title: item.title || null,
    price: item.price && Number(item.price.value),
    currency: item.price && item.price.currency || null,
    product_url: item.itemWebUrl || null,
    image_url: item.image && item.image.imageUrl || null,
    condition: item.condition || item.conditionId || null,
    seller: item.seller && item.seller.username || null,
    seller_feedback_percentage: item.seller && item.seller.feedbackPercentage != null ? Number(item.seller.feedbackPercentage) : null,
    shipping: shipping && Number(shipping.value),
    shipping_currency: shipping && shipping.currency || null,
    raw: item,
    source: 'eBay Browse API'
  };
}
async function searchEbay(wanted, options = {}) {
  const token = options.token || process.env.EBAY_OAUTH_TOKEN;
  let applicationToken = token;
  let tokenObtained = Boolean(token);
  if (!applicationToken && process.env.EBAY_APP_ID && process.env.EBAY_CERT_ID) {
    applicationToken = await getEbayApplicationToken(process.env.EBAY_APP_ID, process.env.EBAY_CERT_ID);
    tokenObtained = Boolean(applicationToken);
  }
  if (!applicationToken) return { platform: 'ebay', status: 'NOT_CONFIGURED', tokenObtained: false, candidates: [], query: buildEbayQuery(wanted) };
  const marketplace = process.env.EBAY_MARKETPLACE_ID || 'EBAY_AU';
  const currency = process.env.EBAY_PRICE_CURRENCY || 'AUD';
  const params = new URLSearchParams();
  params.set('q', buildEbayQuery(wanted) || 'item');
  params.set('limit', String(Math.min(Math.max(Number(options.limit || 50), 1), 200)));
  params.set('sort', 'BEST_MATCH');
  params.set('filter', buildEbayFilter(wanted, currency));
  const endpoint = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
  const requestUrl = endpoint + '?' + params.toString();
  const result = await requestJson(requestUrl, { headers: { Authorization: 'Bearer ' + applicationToken, 'X-EBAY-C-MARKETPLACE-ID': marketplace, 'Accept-Language': 'en-AU' } });
  const data = result.data;
  const rawPath = path.join(PROOF_DIR, 'raw');
  fs.mkdirSync(rawPath, { recursive: true });
  const rawFile = path.join(rawPath, 'EBAY-RAW-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '.json');
  fs.writeFileSync(rawFile, result.raw + '\n', 'utf8');
  return {
    platform: 'ebay', status: 'OK', tokenObtained, marketplace, endpoint, request_url: requestUrl,
    request: { method: 'GET', endpoint, params: Object.fromEntries(params.entries()) },
    response: { http_status: result.statusCode, duration_ms: result.durationMs, result_count: Array.isArray(data.itemSummaries) ? data.itemSummaries.length : 0, total: Number(data.total || 0), raw_response_sha256: sha256(result.raw), raw_response_file: rawFile },
    query: params.get('q'), filter: params.get('filter'), candidates: (data.itemSummaries || []).map(normaliseCandidate)
  };
}
function containsAny(haystack, needles) { const text = String(haystack || '').toLowerCase(); return needles.length > 0 && needles.some(n => text.includes(String(n).toLowerCase())); }
function scoreField(title, wantedValue) { const values = fieldValues({ value: wantedValue }, 'value'); return values.length ? (containsAny(title, values) ? 1 : 0) : null; }
function priceScore(candidate, wanted) {
  if (wanted.max_price == null || !Number.isFinite(Number(wanted.max_price))) return null;
  if (candidate.price == null || !Number.isFinite(Number(candidate.price))) return 0;
  if (candidate.currency && wanted.currency && candidate.currency !== wanted.currency) return null;
  const max = Number(wanted.max_price);
  return candidate.price <= max ? Math.max(0, Math.min(1, 1 - (candidate.price / Math.max(max, 0.01)) * 0.35)) : 0;
}
function rankCandidate(candidate, wanted) {
  const title = candidate.title || '';
  const fields = [['brand', wanted.brand, 0.30], ['size', wanted.size, 0.20], ['colour', wanted.colour, 0.15], ['era', wanted.era, 0.15], ['style', wanted.style, 0.05]];
  const scores = {};
  let numerator = 0, denominator = 0;
  for (const [name, value, weight] of fields) { const score = scoreField(title, value); if (score !== null) { scores[name] = score; numerator += score * weight; denominator += weight; } }
  const ps = priceScore(candidate, wanted); if (ps !== null) { scores.price = ps; const weight = 0.15; numerator += ps * weight; denominator += weight; }
  const total = denominator ? numerator / denominator : 0;
  return { ...candidate, scores, match_score: Number(total.toFixed(4)), verdict: total >= 0.80 ? 'STRONG' : total >= 0.60 ? 'POSSIBLE' : 'WEAK' };
}
function rankCandidates(candidates, wanted) { return candidates.map(c => rankCandidate(c, wanted)).sort((a, b) => b.match_score - a.match_score); }
function loadWanted(wantedId) { return readJsonl(path.join(DATA_DIR, 'wanted-items.jsonl')).find(item => item.id === wantedId) || null; }
function evidenceForCandidate(candidate) {
  const evidence = {};
  for (const field of ['brand', 'size', 'colour', 'era', 'style']) evidence[field] = { source: 'title', value: candidate.title || null };
  evidence.category = { source: 'title_or_item_summary', value: candidate.title || null };
  return evidence;
}
function writeProof(wanted, huntId, runId, adapters, candidates, startedAt, completedAt) {
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  const ebay = adapters.find(a => a.platform === 'ebay') || null;
  const proof = {
    schema_version: '1.1', run_id: runId, wanted_id: wanted.id || null, hunt_id: huntId,
    timestamp: completedAt, started_at: startedAt, completed_at: completedAt,
    wanted: { raw_text: wanted.raw_text || null, brand: wanted.brand || null, category: wanted.category || null, size: wanted.size || null, colour: wanted.colour || null, era: wanted.era || null, style: wanted.style || null, max_price: wanted.max_price ?? null, currency: wanted.currency || null },
    source: ebay ? { platform: ebay.platform, marketplace: ebay.marketplace || null, endpoint: ebay.endpoint || null, request: ebay.request || null, response: ebay.response || null, status: ebay.status, token_obtained: Boolean(ebay.tokenObtained) } : null,
    candidates: candidates.map(c => ({ item_id: c.product_id, item_url: c.product_url, title: c.title, item_price: c.price, item_currency: c.currency, shipping_price: c.shipping, shipping_currency: c.shipping_currency, total_known_cost: c.price != null && c.shipping != null && c.currency === c.shipping_currency ? Number((c.price + c.shipping).toFixed(2)) : null, total_currency: c.currency || null, fx_rate: null, normalized_price_nzd: null, price_normalization_status: c.currency === 'NZD' ? 'NOT_NEEDED' : 'NOT_PERFORMED', seller: c.seller, seller_feedback_percentage: c.seller_feedback_percentage, condition: c.condition, evidence: evidenceForCandidate(c), scores: c.scores, total_score: c.match_score, verdict: c.verdict, raw_reference: ebay && ebay.response ? { sha256: ebay.response.raw_response_sha256, file: ebay.response.raw_response_file } : null })),
    gates: { G0_code_exists: 'PASS', G1_credentials_accepted: ebay && ebay.tokenObtained ? 'PASS' : 'FAIL', G2_oauth_token_obtained: ebay && ebay.tokenObtained ? 'PASS' : 'FAIL', G3_live_request_sent: ebay && ebay.request ? 'PASS' : 'FAIL', G4_http_200: ebay && ebay.response && ebay.response.http_status === 200 ? 'PASS' : 'FAIL', G5_item_summaries_returned: ebay && ebay.response && ebay.response.result_count > 0 ? 'PASS' : 'FAIL', G6_brand_match: candidates.some(c => c.scores.brand >= 0.8) ? 'PASS' : 'FAIL', G7_size_match: candidates.some(c => c.scores.size >= 0.8) ? 'PASS' : 'FAIL', G8_jacket: candidates.some(c => /\bjacket\b/i.test(c.title || '')) ? 'PASS' : 'FAIL', G9_era: candidates.some(c => c.scores.era >= 0.7) ? 'PASS' : 'POSSIBLE', G10_color: candidates.some(c => c.scores.colour >= 0.7) ? 'PASS' : 'POSSIBLE', G11_price_currency_verified: candidates.some(c => c.currency === wanted.currency) ? 'PASS' : 'FAIL', G12_price_cap_verified: candidates.some(c => c.currency === wanted.currency && c.price <= Number(wanted.max_price)) ? 'PASS' : 'FAIL', G13_delivery_country_verified: ebay && ebay.request && /deliveryCountry:NZ/.test(ebay.request.params.filter || '') ? 'PASS' : 'FAIL', G14_url_item_id_present: candidates.some(c => c.product_id && c.product_url) ? 'PASS' : 'FAIL', G15_proof_generated: 'PASS', G16_proof_tied_to_wanted: Boolean(wanted.id) },
    source_feasibility: 'UNPROVEN', commercial_signal: 'UNPROVEN'
  };
  const mandatory = ['G1_credentials_accepted','G2_oauth_token_obtained','G3_live_request_sent','G4_http_200','G5_item_summaries_returned','G6_brand_match','G7_size_match','G8_jacket','G11_price_currency_verified','G12_price_cap_verified','G13_delivery_country_verified','G14_url_item_id_present','G15_proof_generated','G16_proof_tied_to_wanted'];
  proof.source_feasibility = mandatory.every(k => proof.gates[k] === 'PASS') ? 'PASS' : 'FAIL';
  const proofFile = path.join(PROOF_DIR, 'WANTED-HUNT-PROOF-' + runId + '.json');
  fs.writeFileSync(proofFile, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  return { proof, proofFile };
}
async function hunt(wanted, options = {}) {
  if (!wanted || typeof wanted !== 'object') throw new Error('wanted object is required');
  const wantedId = wanted.id || options.wantedId || null;
  const runId = 'run_' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '_' + crypto.randomBytes(3).toString('hex');
  const huntId = 'H-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
  const started = new Date().toISOString();
  const adapters = [];
  let rawCandidates = [];
  try { const ebay = await searchEbay(wanted, options.ebay || {}); adapters.push(ebay); rawCandidates = rawCandidates.concat(ebay.candidates || []); }
  catch (error) { adapters.push({ platform: 'ebay', status: 'ERROR', candidates: [], error: error.message, request: error.meta ? { method: 'GET', endpoint: 'https://api.ebay.com/buy/browse/v1/item_summary/search' } : null, response: error.meta ? { http_status: error.meta.statusCode, duration_ms: error.meta.durationMs, raw_response_sha256: sha256(error.meta.raw || '') } : null }); }
  const ranked = rankCandidates(rawCandidates, wanted).map(candidate => ({ ...candidate, wanted_id: wantedId, hunt_id: huntId, run_id: runId, discovered_at: new Date().toISOString() }));
  for (const candidate of ranked) appendJsonl(CANDIDATE_FILE, candidate);
  const completed = new Date().toISOString();
  const session = { id: huntId, run_id: runId, wanted_id: wantedId, started_at: started, completed_at: completed, candidate_count: ranked.length, best_match_score: ranked.length ? ranked[0].match_score : 0, adapters: adapters.map(a => ({ platform: a.platform, status: a.status, marketplace: a.marketplace || null, request: a.request || null, response: a.response || null })) };
  appendJsonl(SESSION_FILE, session);
  const evidence = writeProof(wanted, huntId, runId, adapters, ranked, started, completed);
  return { status: 'COMPLETE', wanted, wantedId, huntId, runId, adapters, candidates: ranked, session, proofFile: evidence.proofFile, proof: evidence.proof };
}
module.exports = { CANDIDATE_FILE, SESSION_FILE, buildEbayQuery, buildEbayFilter, getEbayApplicationToken, searchEbay, rankCandidate, rankCandidates, loadWanted, hunt, readJsonl };
