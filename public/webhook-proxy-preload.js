'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { Readable } = require('stream');
const distributionDoorway = require('../BEC-PRIME/routes/distributionDoorway');
const mtgDiagnostic = require('../BEC-PRIME/lib/mtgDiagnosticFulfillment');
const mtgDiagnosticRoute = require('../BEC-PRIME/routes/mtgDiagnostic');
const marketplaceWebhook = require('../BEC-PRIME/routes/marketplaceWebhook');
const paidCheckoutWebhook = require('./paidCheckoutWebhook');

function replayRequest(req, body) {
  const replay = Readable.from([body]);
  replay.method = req.method;
  replay.url = req.url;
  replay.headers = req.headers;
  replay.httpVersion = req.httpVersion;
  replay.socket = req.socket;
  return replay;
}

if (!global.__dreamledgerWebhookProxyPreload) {
  const originalCreateServer = http.createServer;
  http.createServer = function wrappedCreateServer(handler) {
    const wrapped = async function webhookProxyHandler(req, res) {
      const requestPath = String(req.url || '').split('?')[0];

      if (req.method === 'GET' && (requestPath === '/mtg/diagnostic.html' || requestPath === '/mtg/diagnostic/')) {
        const file = path.join(__dirname, '..', 'BEC-PRIME', 'compiled', 'website', 'mtg', 'diagnostic.html');
        try {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(fs.readFileSync(file));
        } catch {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('MTG diagnostic surface unavailable');
        }
        return;
      }

      if (req.method === 'GET' && (requestPath === '/mtg/diagnostic-success.html' || requestPath === '/mtg/diagnostic-success/')) {
        const file = path.join(__dirname, '..', 'BEC-PRIME', 'compiled', 'website', 'mtg', 'diagnostic-success.html');
        try {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(fs.readFileSync(file));
        } catch {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('MTG diagnostic success surface unavailable');
        }
        return;
      }

      if (req.method === 'POST' && requestPath === '/api/mtg/diagnostic/intake') {
        let body = Buffer.alloc(0);
        try {
          for await (const chunk of req) {
            body = Buffer.concat([body, Buffer.from(chunk)]);
            if (body.length > 100000) throw new Error('Request too large');
          }
          const result = await mtgDiagnostic.createCheckout(JSON.parse(body.toString('utf8')));
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(result));
        } catch (err) {
          const message = err && err.message ? err.message : 'Diagnostic intake failed';
          const unavailable = /Economic ledger unavailable|checkout held|STRIPE_SECRET_KEY|Stripe/i.test(message);
          res.statusCode = unavailable ? 503 : 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ error: message, code: unavailable ? 'CHECKOUT_TEMPORARILY_UNAVAILABLE' : 'INVALID_DIAGNOSTIC_INPUT' }));
        }
        return;
      }

      if (req.method === 'GET' && requestPath === '/api/mtg/diagnostic/report') {
        const u = new URL(req.url || '/', 'https://dreamledger.org');
        const sessionId = u.searchParams.get('session_id');
        if (!sessionId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'session_id is required' }));
          return;
        }
        const report = mtgDiagnostic.getReport(sessionId);
        res.statusCode = report ? 200 : 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(report || { error: 'Report not ready' }));
        return;
      }

      // /go is served by the canonical static doorway in public/go/index.html.
      // It validates ref/c locally and never blocks on Supabase analytics.
      // Keep distributionDoorway available for its other explicit routes; do not intercept /go here.

      if (req.method === 'GET' && (requestPath === '/truth-oracle' || requestPath === '/truth-oracle/')) {
        const file = path.join(__dirname, '..', 'BEC-PRIME', 'compiled', 'website', 'truth-oracle.html');
        try {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(fs.readFileSync(file));
        } catch {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('Truth Oracle surface unavailable');
        }
        return;
      }

      if (req.method === 'POST' && requestPath === '/api/offer-checkout/create') {
        let body = Buffer.alloc(0);
        try {
          for await (const chunk of req) {
            body = Buffer.concat([body, Buffer.from(chunk)]);
            if (body.length > 100000) throw new Error('Request too large');
          }
          const payload = JSON.parse(body.toString('utf8'));
          const offerId = String(payload && payload.offer_id || '');
          const productId = String(payload && (payload.product_id || payload.sku_id) || '');
          if (['OFFER-CMD-DIAG-29-NZD', 'OFFER-COMMANDER-DECK-DIAGNOSTIC-001'].includes(offerId) || productId === 'COMMANDER-DECK-DIAGNOSTIC-001') {
            res.statusCode = 409;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify({ok:false,code:'FIRST_PARTY_INTAKE_REQUIRED',error:'Commander Diagnostic must use the first-party intake so decklist, intake ID, payment, and fulfillment evidence stay linked.',intake_url:'https://dreamledger.org/mtg/diagnostic.html'}));
            return;
          }
          if (['OFFER-QUOTE-COMPARE-49-NZD'].includes(offerId) || productId === 'QUOTE-COMPARE-49') {
            res.statusCode = 409;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify({ok:false,code:'PAID_OFFER_HELD',error:'Paid Supplier Quote Comparison is held; use the free worksheet inside Truth Oracle.',free_entry_url:'https://dreamledger.org/quote-comparison/'}));
            return;
          }
          return handler(replayRequest(req, body), res);
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Invalid checkout request' }));
          return;
        }
      }

      if (req.method === 'POST' && requestPath === '/webhook') {
        let body = Buffer.alloc(0);
        try {
          for await (const chunk of req) {
            body = Buffer.concat([body, Buffer.from(chunk)]);
            if (body.length > 5000000) throw new Error('Request too large');
          }
        } catch (err) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: err.message || 'Request too large' }));
          return;
        }
        let parsedEvent = null;
        try { parsedEvent = JSON.parse(body.toString('utf8')); } catch {}
        const paidMtgDiagnostic = parsedEvent?.type === 'checkout.session.completed'
          && parsedEvent?.data?.object?.payment_status === 'paid'
          && parsedEvent?.data?.object?.metadata?.product_id === 'COMMANDER-DECK-DIAGNOSTIC-001';
        try {
          const result = await mtgDiagnosticRoute.handleWebhook(replayRequest(req, body), res);
          if (result && result.handled) return;
        } catch (err) {
          if (err && /STRIPE_WEBHOOK_SECRET/.test(err.message || '')) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify({ error: 'Stripe webhook configuration unavailable', code: 'WEBHOOK_CONFIGURATION_MISSING' }));
            return;
          }
          if (err && /Invalid Stripe signature|Expired Stripe signature/.test(err.message || '')) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }
        if (res.writableEnded) return;
        if (paidMtgDiagnostic) {
          // Never acknowledge a paid diagnostic order if report or economic-ledger
          // persistence failed. Stripe must retry until fulfillment is recorded.
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ error: 'MTG diagnostic fulfillment failed; retry required', code: 'MTG_FULFILLMENT_RETRY_REQUIRED' }));
          return;
        }

        const checkoutSession = parsedEvent?.data?.object;
        const needsMarketplaceDispatch = parsedEvent?.type === 'checkout.session.completed' &&
          checkoutSession?.payment_status === 'paid' &&
          (checkoutSession?.metadata?.fulfillment === 'dreammeez_entitlement' ||
           Boolean(checkoutSession?.metadata?.listing_id));
        if (needsMarketplaceDispatch) {
          try {
            const result = await marketplaceWebhook.handle(replayRequest(req, body), res);
            if (result && result.handled) return;
            if (res.writableEnded) return;
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify({ error: 'Marketplace fulfillment handler did not accept the paid event', code: 'MARKETPLACE_FULFILLMENT_RETRY_REQUIRED' }));
          } catch (err) {
            const badSignature = /Invalid Stripe signature|Expired Stripe signature/.test(String(err && err.message || ''));
            res.statusCode = badSignature ? 400 : 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify({
              error: badSignature ? 'Stripe signature verification failed' : 'Marketplace fulfillment could not be durably recorded',
              code: badSignature ? 'WEBHOOK_SIGNATURE_INVALID' : 'MARKETPLACE_FULFILLMENT_RETRY_REQUIRED'
            }));
          }
          return;
        }

        try {
          const event = JSON.parse(body.toString('utf8'));
          if (event && event.type === 'checkout.session.completed') {
            const verified = req.headers['stripe-signature'];
            paidCheckoutWebhook.verify(body.toString('utf8'), verified);
            const result = await paidCheckoutWebhook.persistPaidCheckout(event);
            if (result && result.handled) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.setHeader('Cache-Control', 'no-store');
              res.end(JSON.stringify({received:true, economic_persistence:result}));
              return;
            }
          }
        } catch (err) {
          if (err && /STRIPE_WEBHOOK_SECRET|Invalid Stripe signature|Expired Stripe signature/.test(err.message || '')) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
          if (process.env.WEBHOOK_PERSISTENCE_STRICT === 'true') {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: err.message || 'Economic webhook persistence failed' }));
            return;
          }
        }
        return handler(replayRequest(req, body), res);
      }

      const engine = String(process.env.ENGINE_INTERNAL_URL || '');
      const engineKey = String(process.env.ENGINE_INTERNAL_API_KEY || '');
      const isTruthOracleApi = requestPath === '/api/truth-oracle' || requestPath.startsWith('/api/truth-oracle/');
      if (!isTruthOracleApi) return handler(req, res);
      if (!engine) {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ error: 'DreamLedger engine wiring unavailable', code: 'ENGINE_INTERNAL_URL_MISSING' }));
        return;
      }

      let body = Buffer.alloc(0);
      try {
        for await (const chunk of req) {
          body = Buffer.concat([body, Buffer.from(chunk)]);
          if (body.length > 5000000) throw new Error('Request too large');
        }
        const target = new URL('http://' + engine);
        const headers = {'content-type':req.headers['content-type']||'application/json','content-length':body.length,'stripe-signature':req.headers['stripe-signature']||''};
        if (engineKey) headers['x-dreamledger-internal-key']=engineKey;
        if (req.headers.cookie) headers.cookie=req.headers.cookie;
        const upstream=http.request({hostname:target.hostname,port:Number(target.port||80),path:req.url,method:req.method,headers},response=>{res.statusCode=response.statusCode||502;for(const[key,value]of Object.entries(response.headers)){if(key!=='connection'&&key!=='transfer-encoding'&&value!==undefined)res.setHeader(key,value);}res.setHeader('Cache-Control','no-store');response.pipe(res);});
        upstream.setTimeout(20000,()=>upstream.destroy());
        upstream.on('error',err=>{if(!res.writableEnded){res.statusCode=502;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({error:err.message||'Engine upstream unavailable',code:'ENGINE_UPSTREAM_UNAVAILABLE'}));}});
        upstream.end(body);
      } catch (err) {
        if (!res.writableEnded) {
          res.statusCode=400;
          res.setHeader('Content-Type','application/json; charset=utf-8');
          res.end(JSON.stringify({error:err.message||'Engine proxy failed',code:'ENGINE_PROXY_FAILED'}));
        }
      }
    };
    return originalCreateServer.call(this, wrapped);
  };
  global.__dreamledgerWebhookProxyPreload = true;
}
