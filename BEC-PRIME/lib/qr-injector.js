'use strict';

const crypto = require('crypto');
const QRCode = require('qrcode');
const qrEngine = require('./qrEngine');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CANONICAL_BASE = (process.env.QR_CANONICAL_BASE_URL || 'https://dreamledger.org/').replace(/\/$/, '') + '/';
const QR_ALLOWED_HOSTS = new Set(['dreamledger.org', 'qr.dreamledger.org']);

function sha256Buffer(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function validateContext(context) {
  if (!context || typeof context !== 'object') throw new Error('QR context is required');
  for (const key of ['source', 'channel', 'offerId', 'assetId']) {
    if (!String(context[key] || '').trim()) throw new Error(`QR context.${key} is required`);
  }
}

function canonicalUrl(context) {
  const url = new URL(CANONICAL_BASE);
  url.searchParams.set('sku', String(context.offerId));
  url.searchParams.set('source', String(context.source));
  url.searchParams.set('channel', String(context.channel));
  url.searchParams.set('asset', String(context.assetId));
  if (context.campaign) url.searchParams.set('campaign', String(context.campaign));
  return url.toString();
}

function validateCanonical(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !QR_ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) throw new Error('QR destination must use an owned DreamLedger HTTPS host');
}

async function supabaseRequest(path, init) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for QR manifests');
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init && init.headers ? init.headers : {})
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase QR request failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

function embedHtml(content, qrDataUrl, context) {
  const marker = `dreamledger-qr:${context.assetId}`;
  if (String(content).includes(marker)) return String(content);
  const block = `<!-- ${marker} -->\n<div data-dreamledger-qr="${context.assetId}" data-qr-source="${context.source}" data-qr-channel="${context.channel}" style="margin:16px 0;text-align:center"><a href="${context.canonicalUrl}" rel="noopener"><img src="${qrDataUrl}" alt="Scan to continue with DreamLedger" width="180" height="180"></a></div>`;
  return String(content).includes('</body>') ? String(content).replace('</body>', `${block}\n</body>`) : `${content}\n${block}`;
}

function embedSvg(content, qrSvg, context) {
  const marker = `dreamledger-qr:${context.assetId}`;
  if (String(content).includes(marker)) return String(content);
  const block = `<!-- ${marker} -->\n<g data-dreamledger-qr="${context.assetId}" transform="translate(16 16)">${qrSvg.replace('<svg', '<g').replace('</svg>', '</g>')}</g>`;
  return String(content).includes('</svg>') ? String(content).replace('</svg>', `${block}\n</svg>`) : `${content}\n${block}`;
}

function embed(asset, qrDataUrl, qrSvg, context) {
  const format = String(asset.format || '').toLowerCase();
  if (format === 'html' || format === 'htm') return { ...asset, content: embedHtml(asset.content, qrDataUrl, context) };
  if (format === 'svg') return { ...asset, content: embedSvg(asset.content, qrSvg, context) };
  throw new Error(`No safe QR embed adapter exists for asset format '${format}'. Release is blocked.`);
}

async function injectQR(asset, context) {
  validateContext(context);
  const format = String(asset && asset.format || '').toLowerCase();
  if (!['html', 'htm', 'svg'].includes(format)) throw new Error(`No safe QR embed adapter exists for asset format '${format}'. Release is blocked.`);
  const canonical = canonicalUrl(context);
  validateCanonical(canonical);
  const enrichedContext = { ...context, canonicalUrl: canonical };

  const existing = await supabaseRequest(`/rest/v1/qr_manifest?asset_id=eq.${encodeURIComponent(context.assetId)}&source=eq.${encodeURIComponent(context.source)}&channel=eq.${encodeURIComponent(context.channel)}&offer_id=eq.${encodeURIComponent(context.offerId)}&select=id,qr_url,sha256_hash,asset_sha256_hash&limit=1`, { method: 'GET' });
  if (existing && existing[0]) {
    const q = await qrEngine.getByShortUrl(existing[0].qr_url);
    if (q) {
      const qrDataUrl = await QRCode.toDataURL(existing[0].qr_url, { width: 512, margin: 2, errorCorrectionLevel: 'H' });
      const qrSvg = await QRCode.toString(existing[0].qr_url, { type: 'svg', width: 512, margin: 2, errorCorrectionLevel: 'H' });
      return { asset: embed(asset, qrDataUrl, qrSvg, enrichedContext), manifestId: existing[0].id, qrUrl: existing[0].qr_url, idempotent: true };
    }
  }

  const qr = await qrEngine.createManagedQr({
    destination: canonical,
    title: `${context.offerId}:${context.assetId}`,
    metadata: { asset_id: context.assetId, source: context.source, channel: context.channel, offer_id: context.offerId }
  });
  const qrBuffer = Buffer.from(qr.png_data_url.split(',')[1], 'base64');
  const assetHash = crypto.createHash('sha256').update(typeof asset.content === 'string' ? asset.content : Buffer.from(asset.content)).digest('hex');
  const manifest = await supabaseRequest('/rest/v1/qr_manifest?select=id', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      asset_id: context.assetId,
      source: context.source,
      channel: context.channel,
      offer_id: context.offerId,
      canonical_url: canonical,
      qr_url: qr.short_url,
      sha256_hash: sha256Buffer(qrBuffer),
      asset_sha256_hash: assetHash
    })
  });
  const manifestId = manifest[0].id;
  await qrEngine.attachManifest(qr.id, manifestId);
  const qrSvg = await QRCode.toString(qr.short_url, { type: 'svg', width: 512, margin: 2, errorCorrectionLevel: 'H' });
  return { asset: embed(asset, qr.png_data_url, qrSvg, enrichedContext), manifestId, qrUrl: qr.short_url, idempotent: false };
}

module.exports = { injectQR };
