'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { Readable } = require('stream');
const distributionDoorway = require('../BEC-PRIME/routes/distributionDoorway');
const mtgDiagnostic = require('../BEC-PRIME/lib/mtgDiagnosticFulfillment');

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
          const result = await mtgDiagnostic.createPaymentLinkCheckout(JSON.parse(body.toString('utf8')));
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(result));
        } catch (err) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: err && err.message ? err.message : 'Diagnostic intake failed' }));
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

      if (req.method === 'GET' && requestPath === '/go') {
        try {
          const handled = await distributionDoorway.handle(req, res);
          if (handled) return;
        } catch (err) {
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify({ error: err && err.message ? err.message : 'Doorway failed', code: 'DOORWAY_FAILED' }));
          }
          return;
        }
      }

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
          if (payload && payload.offer_id === 'OFFER-CMD-DIAG-29-NZD') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify({ok:true,offer_id:'OFFER-CMD-DIAG-29-NZD',product_id:'COMMANDER-DECK-DIAGNOSTIC-001',amount_nzd:29,currency:'NZD',checkout_url:'https://buy.stripe.com/00w7sLaXP01n96nbN2dwc2l'}));
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
        try {
          const result = await mtgDiagnostic.handleWebhook(replayRequest(req, body), res);
          if (result && result.handled) return;
        } catch (err) {
          if (err && /STRIPE_WEBHOOK_SECRET|Invalid Stripe signature|Expired Stripe signature/.test(err.message || '')) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }
        if (res.writableEnded) return;
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
