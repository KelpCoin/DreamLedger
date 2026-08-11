'use strict';

const crypto = require('crypto');

const BASE_URL = (process.env.DIGITAL_PROXY_LM_BASE_URL || 'http://127.0.0.1:1234/v1').replace(/\/$/, '');
const MODEL = process.env.DIGITAL_PROXY_LM_MODEL || '';

function digest(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex').slice(0, 16);
}

function fallback(message) {
  const text = String(message || '').toLowerCase();
  if (/account|login|sign.?up|avatar|streak/.test(text)) {
    return 'I can help with accounts, avatars, daily streaks and Dreamiez rewards. Use the account controls on this page, then return here if a step is unclear.';
  }
  if (/buy|checkout|price|payment|stripe/.test(text)) {
    return 'I can explain an offer, price or checkout step. Payments stay behind the approval and verification gates.';
  }
  if (/auction|bid/.test(text)) {
    return 'I can explain an auction, reserve, Buy Now or bidding step. Bids remain silo-scoped and approval-gated.';
  }
  return 'Tell me what you are trying to do on DreamLedger and I will point you to the smallest next step. This assistant only responds when you ask.';
}

async function reply(message, context = {}) {
  const clean = String(message || '').trim().slice(0, 1200);
  if (!clean) return { status: 'READY', reply: fallback('') };
  if (!MODEL || process.env.DIGITAL_PROXY_LM_ENABLED !== 'true') return { status: 'LOCAL_FALLBACK', reply: fallback(clean) };

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 300,
      messages: [
        { role: 'system', content: 'You are the DreamLedger Digital Proxy, a lightweight navigation assistant. Be concise, practical and non-invasive. Never claim to be the owner. Never request passwords, payment secrets or private customer data. Never publish, charge, approve, or execute an external action. Help the user navigate the current website.' },
        { role: 'user', content: JSON.stringify({ message: clean, context }) }
      ]
    })
  });
  if (!response.ok) throw new Error(`Digital Proxy model ${response.status}`);
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Digital Proxy returned no message');
  return { status: 'MODEL', reply: String(text).slice(0, 3000), response_id: `DP-${digest(clean)}` };
}

module.exports = { reply };
