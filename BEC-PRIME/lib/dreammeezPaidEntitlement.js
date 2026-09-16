'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DREAMIEZ_DATA = process.env.DREAMIEZ_DATA_DIR || ((fs.existsSync('/var/data') && fs.statSync('/var/data').isDirectory()) ? '/var/data/dreamiez' : path.join(ROOT, 'data', 'dreamiez'));
const USERS = path.join(DREAMIEZ_DATA, 'users.json');
const COSMETICS = path.join(DREAMIEZ_DATA, 'cosmetics.json');
const ENTITLEMENTS = path.join(DREAMIEZ_DATA, 'paid-entitlements.json');

const SKU_TO_COSMETIC = {
  'COSMIC-HOODIE': 'cosmic-hoodie',
  'CAPE': 'cape',
  'CHROME-BOOTS': 'chrome-boots'
};

function read(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function cosmeticForSku(sku) {
  const id = SKU_TO_COSMETIC[String(sku || '').trim().toUpperCase()];
  if (!id) return null;
  return read(COSMETICS, []).find(item => item.id === id && item.product_id === String(sku).trim().toUpperCase()) || null;
}

function grantPaidCosmetic({ eventId, transactionId, session, sku }) {
  const cosmetic = cosmeticForSku(sku);
  if (!cosmetic) return { handled: false, reason: 'unknown_cosmetic_sku', sku };

  const email = normalizeEmail(session?.customer_details?.email || session?.customer_email || session?.customer_email_address);
  if (!email) return { handled: true, status: 'PENDING_ACCOUNT_EMAIL', sku, cosmetic_id: cosmetic.id };

  const entitlements = read(ENTITLEMENTS, []);
  const existing = entitlements.find(x => x.transaction_id === transactionId || (eventId && x.event_id === eventId));
  if (existing) return { handled: true, ...existing, idempotent: true };

  const users = read(USERS, []);
  const user = users.find(x => normalizeEmail(x.email) === email && x.email_verified === true);
  const record = {
    entitlement_id: `ent_${crypto.randomBytes(10).toString('hex')}`,
    event_id: eventId || null,
    transaction_id: transactionId,
    sku: String(sku).trim().toUpperCase(),
    cosmetic_id: cosmetic.id,
    customer_email: email,
    account_id: user?.id || null,
    status: user ? 'GRANTED' : 'PENDING_ACCOUNT',
    granted_at: new Date().toISOString()
  };

  if (user) {
    user.cosmetics = Array.isArray(user.cosmetics) ? user.cosmetics : [];
    if (!user.cosmetics.includes(cosmetic.id)) user.cosmetics.push(cosmetic.id);
    write(USERS, users);
  }

  entitlements.push(record);
  write(ENTITLEMENTS, entitlements);
  return { handled: true, ...record };
}

function reconcilePendingForAccount(user) {
  const email = normalizeEmail(user?.email);
  if (!email || user?.email_verified !== true) return { granted: 0, pending: 0 };
  const entitlements = read(ENTITLEMENTS, []);
  const users = read(USERS, []);
  const stored = users.find(x => x.id === user.id);
  if (!stored) return { granted: 0, pending: 0 };
  stored.cosmetics = Array.isArray(stored.cosmetics) ? stored.cosmetics : [];
  let granted = 0;
  let pending = 0;
  for (const item of entitlements) {
    if (item.status !== 'PENDING_ACCOUNT' || normalizeEmail(item.customer_email) !== email) continue;
    if (!stored.cosmetics.includes(item.cosmetic_id)) stored.cosmetics.push(item.cosmetic_id);
    item.account_id = stored.id;
    item.status = 'GRANTED';
    item.granted_at = item.granted_at || new Date().toISOString();
    granted += 1;
  }
  pending = entitlements.filter(x => x.status === 'PENDING_ACCOUNT' && normalizeEmail(x.customer_email) === email).length;
  if (granted) {
    write(USERS, users);
    write(ENTITLEMENTS, entitlements);
  }
  return { granted, pending };
}

module.exports = { grantPaidCosmetic, reconcilePendingForAccount, cosmeticForSku, SKU_TO_COSMETIC };
