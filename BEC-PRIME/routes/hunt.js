'use strict';

const https = require('https');

function requestJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'DreamLedger-WANTED/1.0', Accept: 'application/json', ...headers } }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; if (body.length > 2000000) req.destroy(new Error('Response too large')); });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error('HTTP ' + res.statusCode));
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Invalid JSON response')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Request timeout')));
  });
}

function buildEbayQuery(wanted) {
  return [wanted.brand, wanted.category, wanted.style, wanted.colour, wanted.size].filter(Boolean).join(' ').trim();
}

async function searchEbayBrowse(wanted, token) {
  if (!token) return { platform: 'ebay', status: 'NOT_CONFIGURED', candidates: [] };
  const params = new URLSearchParams({ q: buildEbayQuery(wanted), limit: '20', sort: 'BEST_MATCH' });
  if (wanted.max_price != null) params.set('filter', 'price:[' + wanted.max_price + '..]');
  const data = await requestJson('https://api.ebay.com/buy/browse/v1/item_summary/search?' + params.toString(), { Authorization: 'Bearer ' + token });
  const candidates = (data.itemSummaries || []).map(x => ({
    platform: 'ebay',
    product_id: x.itemId || null,
    title: x.title || null,
    price: x.price && Number(x.price.value),
    currency: x.price && x.price.currency || null,
    product_url: x.itemWebUrl || null,
    image_url: x.image && x.image.imageUrl || null,
    condition: x.condition || null
  }));
  return { platform: 'ebay', status: 'OK', candidates };
}

function buildTradeMeQuery(wanted) {
  return [wanted.brand, wanted.category, wanted.style, wanted.colour, wanted.size].filter(Boolean).join(' ').trim();
}

async function searchTradeMe(wanted, config) {
  if (!config || !config.consumerKey) return { platform: 'trademe', status: 'NOT_CONFIGURED', candidates: [] };
  return { platform: 'trademe', status: 'ADAPTER_REQUIRED', candidates: [], note: 'Trade Me authentication/search contract must be implemented from current API credentials and permissions before live requests.' };
}

async function handle(req, res, requestPath) {
  if (requestPath !== '/api/hunt' || req.method !== 'POST') return false;
  let body = '';
  req.on('data', chunk => { body += chunk; if (body.length > 50000) req.destroy(new Error('Request too large')); });
  req.on('end', async () => {
    try {
      const input = JSON.parse(body || '{}');
      if (!input.wanted) throw new Error('wanted is required');
      const ebay = await searchEbayBrowse(input.wanted, input.ebayToken || process.env.EBAY_OAUTH_TOKEN);
      const trademe = await searchTradeMe(input.wanted, input.tradeMe);
      const candidates = [...ebay.candidates, ...trademe.candidates];
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ status: 'COMPLETE', candidates, adapters: [ebay, trademe] }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ status: 'FAILED', error: err.message || 'hunt failed' }));
    }
  });
  return true;
}

module.exports = { handle, buildEbayQuery, buildTradeMeQuery };
