'use strict';

// Signed, host-only DreamLedger session cookie.
// The cookie carries an account id plus an HMAC signature. It is not an
// authentication credential by itself; the server still resolves the account
// from the canonical persistence authority on every request.
const crypto = require('crypto');

const COOKIE = '__Host-dreamiez_session';
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  const value = String(process.env.DREAMLEDGER_SESSION_SECRET || '');
  if (!value || value.length < 32) {
    throw new Error('DreamLedger session signing secret is not configured or is too short.');
  }
  return value;
}

function parseCookieHeader(req) {
  const raw = String(req.headers.cookie || '');
  const out = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

function sign(accountId) {
  return crypto.createHmac('sha256', secret()).update(String(accountId), 'utf8').digest('base64url');
}

function encode(accountId) {
  const id = String(accountId);
  return encodeURIComponent(id + '.' + sign(id));
}

function decode(value) {
  if (!value) return null;
  let decoded;
  try { decoded = decodeURIComponent(String(value)); } catch { return null; }
  const dot = decoded.lastIndexOf('.');
  if (dot <= 0 || dot === decoded.length - 1) return null;
  const accountId = decoded.slice(0, dot);
  const supplied = decoded.slice(dot + 1);
  const expected = sign(accountId);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return accountId;
}

function get(req) {
  return decode(parseCookieHeader(req)[COOKIE]);
}

function set(res, accountId) {
  res.setHeader('Set-Cookie', COOKIE + '=' + encode(accountId) + '; Path=/; Max-Age=' + MAX_AGE + '; HttpOnly; Secure; SameSite=Lax');
}

function clear(res) {
  res.setHeader('Set-Cookie', COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
}

module.exports = { COOKIE, MAX_AGE, get, set, clear, sign, encode, decode };
