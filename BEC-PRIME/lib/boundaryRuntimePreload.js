'use strict';
const http=require('http');
const crypto=require('crypto');
const originalCreateServer=http.createServer;
const expected=String(process.env.ENGINE_INTERNAL_API_KEY||'');
function safeEqual(a,b){const aa=Buffer.from(String(a));const bb=Buffer.from(String(b));return aa.length===bb.length&&aa.length>0&&crypto.timingSafeEqual(aa,bb);}
http.createServer=function boundaryCreateServer(...args){const handler=typeof args[0]==='function'?args[0]:null;if(!handler)return originalCreateServer.apply(this,args);args[0]=function boundaryGuard(req,res){const p=String(req.url||'').split('?')[0];if(req.method==='GET'&&p==='/healthz')return handler(req,res);if(!expected){res.statusCode=503;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');return res.end(JSON.stringify({error:'Engine internal authentication is not configured',code:'ENGINE_INTERNAL_API_KEY_MISSING'}));}if(!safeEqual(req.headers['x-dreamledger-internal-key']||'',expected)){res.statusCode=404;res.setHeader('Content-Type','text/plain; charset=utf-8');return res.end('Not Found');}return handler(req,res);};return originalCreateServer.apply(this,args);};