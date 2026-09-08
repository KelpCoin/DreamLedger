'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

if (!global.__dreamledgerDiscordCommercePreload) {
  const originalCreateServer = http.createServer;
  const PUBLIC_ROOT = path.join(__dirname, '..', '..', 'public');
  const ZIP = path.join(PUBLIC_ROOT, 'downloads', 'discord-webhook-starter-kit.zip');
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
  const STRIPE_PRICE_ID = process.env.DISCORD_STARTER_STRIPE_PRICE_ID || 'price_1U4FWXEGgEAnUFF9Pyazprfo';
  const PRODUCT_ID = 'DISCORD-WEBHOOK-STARTER-KIT-001';

  function send(res, status, body) {
    if (res.writableEnded) return;
    res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify(body));
  }

  async function verifyPaidSession(sessionId) {
    if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
    if (!/^cs_[A-Za-z0-9_]+$/.test(String(sessionId))) throw new Error('Invalid checkout session');
    const target = new URL('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(sessionId));
    const response = await fetch(target, {headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY}});
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Stripe session lookup failed');
    if (data.payment_status !== 'paid') throw new Error('Payment is not confirmed');
    const price = data.line_items?.data?.[0]?.price?.id;
    const metadataProduct = data.metadata?.offer_id || data.metadata?.product_id || '';
    if (price && price !== STRIPE_PRICE_ID) throw new Error('Checkout product mismatch');
    if (metadataProduct && metadataProduct !== PRODUCT_ID && metadataProduct !== 'discord-webhook-starter-kit') throw new Error('Checkout product mismatch');
    return data;
  }

  http.createServer = function wrappedCreateServer(handler) {
    return originalCreateServer.call(this, async function discordCommerceHandler(req, res) {
      const route = String(req.url || '').split('?')[0];
      if (req.method === 'GET' && route === '/discord/starter-kit-success.html') {
        try {
          const file = path.join(PUBLIC_ROOT, 'discord', 'starter-kit-success.html');
          res.writeHead(200, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
          res.end(fs.readFileSync(file));
        } catch { send(res, 503, {error:'Fulfillment surface unavailable'}); }
        return;
      }
      if (req.method === 'GET' && route === '/api/discord/starter-kit/download') {
        try {
          const sessionId = new URL(req.url || '/', 'https://dreamledger.org').searchParams.get('session_id');
          await verifyPaidSession(sessionId);
          if (!fs.existsSync(ZIP)) throw new Error('Digital package is not published yet');
          send(res, 200, {ok:true,product_id:PRODUCT_ID,download_url:'/downloads/discord-webhook-starter-kit.zip?session_id='+encodeURIComponent(sessionId)});
        } catch (err) { send(res, 402, {error:err.message || 'Fulfillment unavailable'}); }
        return;
      }
      if (req.method === 'GET' && route === '/downloads/discord-webhook-starter-kit.zip') {
        try {
          const sessionId = new URL(req.url || '/', 'https://dreamledger.org').searchParams.get('session_id');
          await verifyPaidSession(sessionId);
          if (!fs.existsSync(ZIP)) throw new Error('Digital package is not published yet');
          const file = fs.readFileSync(ZIP);
          res.writeHead(200, {'Content-Type':'application/zip','Content-Disposition':'attachment; filename="discord-webhook-starter-kit.zip"','Cache-Control':'private, no-store'});
          res.end(file);
        } catch (err) { send(res, 402, {error:err.message || 'Download unavailable'}); }
        return;
      }
      return handler(req, res);
    });
  };
  global.__dreamledgerDiscordCommercePreload = true;
}
