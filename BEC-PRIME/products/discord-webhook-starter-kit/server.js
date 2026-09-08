'use strict';

const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';

function verifyStripe(raw, header) {
  if (!STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  const parts = String(header || '').split(',');
  const timestamp = Number((parts.find(p => p.startsWith('t=')) || '').slice(2));
  const signatures = parts.filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  if (!timestamp || !signatures.length) throw new Error('Invalid Stripe signature');
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) throw new Error('Expired Stripe signature');
  const expected = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${raw}`, 'utf8').digest('hex');
  if (!signatures.some(sig => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))) throw new Error('Invalid Stripe signature');
}

async function readBody(req, max = 5_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw new Error('Request too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function postToDiscord(message) {
  if (!DISCORD_WEBHOOK_URL) throw new Error('DISCORD_WEBHOOK_URL is not configured');
  const response = await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: message.slice(0, 1900) })
  });
  if (!response.ok) throw new Error(`Discord webhook returned HTTP ${response.status}`);
}

const server = http.createServer(async (req, res) => {
  const route = String(req.url || '').split('?')[0];
  const send = (status, body) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  };

  if (req.method === 'GET' && route === '/healthz') return send(200, { status: 'ok' });
  if (req.method !== 'POST' || route !== '/stripe/webhook') return send(404, { error: 'Not found' });

  try {
    const raw = await readBody(req);
    verifyStripe(raw, req.headers['stripe-signature']);
    const event = JSON.parse(raw);
    if (event.type !== 'checkout.session.completed') return send(200, { received: true, handled: false });
    const session = event.data && event.data.object;
    if (!session || session.payment_status !== 'paid') return send(200, { received: true, handled: false });
    const amount = Number(session.amount_total || 0) / 100;
    const currency = String(session.currency || '').toUpperCase();
    const product = session.metadata && session.metadata.product ? session.metadata.product : 'Stripe purchase';
    await postToDiscord(`Paid order received: ${product} | ${currency} ${amount.toFixed(2)} | ${session.id}`);
    return send(200, { received: true, handled: true, event_id: event.id });
  } catch (err) {
    return send(400, { error: err.message || 'Webhook rejected' });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Discord Webhook Starter Kit listening on ${PORT}`));
