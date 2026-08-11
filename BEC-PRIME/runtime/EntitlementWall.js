'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const TRANSACTIONS = path.resolve(process.env.LEDGER_DATA_DIR || path.join(ROOT, 'data', 'transactions'));
const GOODS = path.join(ROOT, 'private-goods');
const CATALOG = path.join(ROOT, 'catalog', 'evergreen-products.json');

function loadCatalog() {
  if (!fs.existsSync(CATALOG)) return { products: [] };
  return JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
}
function findTransaction(sessionId) {
  if (!sessionId || !fs.existsSync(TRANSACTIONS)) return null;
  const file = path.join(TRANSACTIONS, `${sessionId}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const tx = JSON.parse(fs.readFileSync(file, 'utf8'));
    return tx.payment_status === 'paid' ? tx : null;
  } catch (_) { return null; }
}
function findProduct(id) {
  return (loadCatalog().products || []).find(p => p.product_id === id) || null;
}
function entitlementFor(sessionId, productId) {
  const tx = findTransaction(sessionId);
  const product = findProduct(productId);
  if (!tx || !product) return { granted: false, reason: 'verified_payment_or_product_missing' };
  if (tx.product_id !== productId && tx.offer_id !== productId) return { granted: false, reason: 'entitlement_mismatch' };
  const mode = product.entitlement?.mode || 'permanent';
  const grantedAt = new Date(tx.created_at || Date.now());
  const days = Number(product.entitlement?.duration_days || 0);
  const expiresAt = mode === 'temporary' && days > 0 ? new Date(grantedAt.getTime() + days * 86400000) : null;
  if (expiresAt && expiresAt.getTime() <= Date.now()) return { granted: false, reason: 'entitlement_expired', expires_at: expiresAt.toISOString() };
  return { granted: true, product_id: productId, mode, granted_at: grantedAt.toISOString(), expires_at: expiresAt ? expiresAt.toISOString() : null, transaction_id: tx.transaction_id, proof: 'verified_transaction_record' };
}
function safeRelative(file) {
  const normalized = path.normalize(file).replace(/^([.][.][/\\])+/, '');
  const target = path.join(GOODS, normalized);
  if (target !== GOODS && !target.startsWith(GOODS + path.sep)) return null;
  return target;
}
function readGood(sessionId, productId, relativeFile) {
  const entitlement = entitlementFor(sessionId, productId);
  if (!entitlement.granted) return { status: 403, body: entitlement };
  const target = safeRelative(relativeFile || 'index.html');
  if (!target || !fs.existsSync(target)) return { status: 404, body: { error: 'Protected good not found' } };
  const data = fs.readFileSync(target);
  const proof = crypto.createHash('sha256').update(data).digest('hex');
  return { status: 200, data, proof, entitlement };
}
module.exports = { entitlementFor, readGood, findProduct };
