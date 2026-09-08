'use strict';

const crypto = require('crypto');

const ALLOWED_HOSTS = new Set(['dreamledger.org', 'qr.dreamledger.org']);

function pass(id, message) { return { id, status: 'PASS', message }; }
function fail(id, message) { return { id, status: 'FAIL', message }; }

async function verifyQRAsset(asset, context, supabaseRequest) {
  const checks = [];
  if (!context || context.requiresQR === false) return { status: 'PASS', checks: [pass('qr.not_required', 'QR injection is explicitly disabled for this asset')] };
  if (!context.assetId) return { status: 'FAIL', checks: [fail('qr.asset_id', 'Asset ID is required when QR injection is required')] };
  if (!supabaseRequest) return { status: 'FAIL', checks: [fail('qr.supabase', 'Supabase manifest lookup is required for QR release verification')] };

  let rows;
  try {
    rows = await supabaseRequest(`/rest/v1/qr_manifest?asset_id=eq.${encodeURIComponent(context.assetId)}&source=eq.${encodeURIComponent(context.source)}&channel=eq.${encodeURIComponent(context.channel)}&offer_id=eq.${encodeURIComponent(context.offerId)}&select=id,qr_url,canonical_url,sha256_hash&limit=1`);
  } catch (error) {
    return { status: 'FAIL', checks: [fail('qr.manifest_lookup', error.message)] };
  }

  if (!rows || !rows[0]) return { status: 'FAIL', checks: [fail('qr.manifest_present', `No QR manifest exists for ${context.assetId}`)] };
  const manifest = rows[0];
  checks.push(pass('qr.manifest_present', 'QR manifest exists'));

  try {
    const qrUrl = new URL(manifest.qr_url);
    const canonicalUrl = new URL(manifest.canonical_url);
    if (qrUrl.protocol !== 'https:' || !ALLOWED_HOSTS.has(qrUrl.hostname.toLowerCase())) {
      checks.push(fail('qr.domain', 'QR URL is not on an owned DreamLedger HTTPS host'));
    } else {
      checks.push(pass('qr.domain', 'QR URL uses an owned DreamLedger host'));
    }
    if (canonicalUrl.protocol !== 'https:' || !ALLOWED_HOSTS.has(canonicalUrl.hostname.toLowerCase())) {
      checks.push(fail('qr.canonical_domain', 'Canonical URL is not on an owned DreamLedger HTTPS host'));
    } else {
      checks.push(pass('qr.canonical_domain', 'Canonical URL uses an owned DreamLedger host'));
    }
  } catch {
    checks.push(fail('qr.url_valid', 'Manifest contains an invalid URL'));
  }

  if (!/^[a-f0-9]{64}$/i.test(String(manifest.sha256_hash || ''))) checks.push(fail('qr.hash', 'QR SHA-256 hash is missing or malformed'));
  else checks.push(pass('qr.hash', 'QR SHA-256 hash is present'));

  return {
    status: checks.every(check => check.status === 'PASS') ? 'PASS' : 'FAIL',
    checks,
    manifest_id: manifest.id,
    evidence_hash: crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex')
  };
}

module.exports = { verifyQRAsset };
