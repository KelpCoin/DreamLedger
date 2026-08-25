'use strict';

const http = require('http');
const crypto = require('crypto');
const { Readable } = require('stream');
const billboard = require('../routes/billboard-v2');

function verifyStripe(raw, signature, secret) {
  if (!signature || !secret) return false;
  const parts = String(signature).split(',');
  const tPart = parts.find(x => x.startsWith('t='));
  const v1 = parts.filter(x => x.startsWith('v1=')).map(x => x.slice(3));
  if (!tPart || !v1.length) return false;
  const timestamp = Number(tPart.slice(2));
  if (!Number.isFinite(timestamp) || Math.abs(Math.floor(Date.now()/1000) - timestamp) > 300) return false;
  const signed = `${timestamp}.${raw}`;
  const expected = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  return v1.some(v => v.length === expected.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(expected)));
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
          if (verifyStripe(raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET || '')) {
            const event = JSON.parse(raw);
            if (event?.type === 'checkout.session.completed' && event?.data?.object?.metadata?.product === 'DREAMLEDGER-BILLBOARD') {
              const handled = billboard.handlePaidSession(event.data.object, event.id);
              if (handled) {
                res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
                return res.end(JSON.stringify({received:true,billboard:true}));
              }
            }
          }
        } catch (err) {
          if (!res.writableEnded) {
            res.writeHead(400, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
            return res.end(JSON.stringify({error: err.message || 'Webhook rejected'}));
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
