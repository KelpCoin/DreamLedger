'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const billboard = require('../routes/billboard-v2');
const autoFulfillment = require('./billboardAutoFulfillment');

const OFFER_ID_CANONICAL = 'OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001';
const OFFER_ID_LEGACY = 'DREAMLEDGER-BILLBOARD-FOUNDING-001';
const FAILURE_ROOT = process.env.BILLBOARD_WEBHOOK_FAILURE_DIR || '/var/data/billboard/webhook-failures';

function verifyStripe(raw, signature, secret) {
  if (!signature || !secret) return false;
  const parts = String(signature).split(',');
  const tPart = parts.find(x => x.startsWith('t='));
  const v1 = parts.filter(x => x.startsWith('v1=')).map(x => x.slice(3));
  if (!tPart || !v1.length) return false;
  const timestamp = Number(tPart.slice(2));
  if (!Number.isFinite(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;
  const signed = `${timestamp}.${raw}`;
  const expected = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  return v1.some(v => v.length === expected.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(expected)));
}

function recordProcessingFailure(event, err) {
  try {
    fs.mkdirSync(FAILURE_ROOT, { recursive: true });
    const eventId = String(event?.id || 'unknown');
    const file = path.join(FAILURE_ROOT, `${eventId}.json`);
    if (fs.existsSync(file)) return;
    fs.writeFileSync(file, JSON.stringify({
      schema_version: 'DL-STRIPE-WEBHOOK-FAILURE-1',
      provider_event_id: eventId,
      event_type: event?.type || null,
      livemode: event?.livemode === true,
      error_message: String(err?.message || err),
      occurred_at: new Date().toISOString()
    }, null, 2) + '\n', { flag: 'wx' });
  } catch (recordErr) {
    console.error('BILLBOARD_WEBHOOK_FAILURE_RECORD', recordErr.message);
  }
}

if (!http.createServer.__dreamledgerBillboardWebhookWrapped) {
  const originalCreateServer = http.createServer;
  const wrappedCreateServer = function(...args) {
    const originalHandler = typeof args[0] === 'function' ? args[0] : ((req, res) => {});
    args[0] = async function(req, res) {
      const requestPath = String(req.url || '').split('?')[0];
      if (req.method === 'POST' && requestPath === '/webhook') {
        let raw = '';
        try {
          for await (const chunk of req) {
            raw += chunk.toString();
            if (raw.length > 5000000) throw new Error('Request too large');
          }
        } catch (err) {
          if (!res.writableEnded) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            return res.end(JSON.stringify({ error: err.message || 'Webhook body rejected' }));
          }
          return;
        }

        let event;
        try {
          if (!verifyStripe(raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET || '')) {
            throw new Error('Invalid Stripe signature');
          }
          event = JSON.parse(raw);
        } catch (err) {
          if (!res.writableEnded) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            return res.end(JSON.stringify({ error: err.message || 'Webhook rejected' }));
          }
          return;
        }

        try {
          if (event?.type === 'checkout.session.completed') {
            const session = event.data?.object;
            const offerId = session?.metadata?.offer_id || session?.metadata?.offerId;

            if (offerId === OFFER_ID_CANONICAL || offerId === OFFER_ID_LEGACY) {
              const result = await autoFulfillment.fulfill(session, event.id);
              if (result.handled) {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
                return res.end(JSON.stringify({ received: true, billboard: true, fulfillment: result }));
              }
            }

            if (session?.metadata?.product === 'DREAMLEDGER-BILLBOARD') {
              const handled = billboard.handlePaidSession(session, event.id);
              if (handled) {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
                return res.end(JSON.stringify({ received: true, billboard: true }));
              }
            }
          }
        } catch (err) {
          recordProcessingFailure(event, err);
          if (!res.writableEnded) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            return res.end(JSON.stringify({ received: false, error: 'processing_failed' }));
          }
          return;
        }

        const replay = Readable.from([raw]);
        replay.method = req.method;
        replay.url = req.url;
        replay.headers = req.headers;
        replay.httpVersion = req.httpVersion;
        replay.socket = req.socket;
        return originalHandler(replay, res);
      }
      return originalHandler(req, res);
    };
    return originalCreateServer.apply(this, args);
  };
  wrappedCreateServer.__dreamledgerBillboardWebhookWrapped = true;
  http.createServer = wrappedCreateServer;
}

module.exports = {};
