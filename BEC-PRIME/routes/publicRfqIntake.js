'use strict';

// Transitional HTTP adapter. The worker is the only persistence/API implementation.
// Never silently fall back to local or in-memory state when the worker is unavailable.
const WORKER_URL = String(process.env.MARKETPLACE_WORKER_URL || '').replace(/\/$/, '');
const ALLOWED = [
  /^\/api\/marketplace\/intake$/,
  /^\/api\/marketplace\/listings$/,
  /^\/api\/marketplace\/rfqs$/,
  /^\/api\/marketplace\/organizations$/,
  /^\/api\/marketplace\/proposals$/,
  /^\/api\/marketplace\/council$/,
  /^\/api\/marketplace\/listings\/[0-9a-f-]+\/transition$/i
];
async function handle(req,res,pathname) {
  if (!ALLOWED.some(pattern => pattern.test(pathname))) return false;
  const send=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));};
  if (!['GET','POST','OPTIONS'].includes(req.method)) { send(405,{error:'METHOD_NOT_ALLOWED'}); return true; }
  if (req.method==='OPTIONS') { res.statusCode=204;res.setHeader('Cache-Control','no-store');res.end();return true; }
  if (!WORKER_URL) { send(503,{error:'MARKETPLACE_WORKER_NOT_CONFIGURED'}); return true; }
  try {
    const headers={'content-type':req.headers['content-type']||'application/json'};
    const access=req.headers['cf-access-jwt-assertion'];
    if(typeof access==='string' && access.length<20000) headers['cf-access-jwt-assertion']=access;
    const init={method:req.method,headers};
    if(req.method==='POST'){
      const chunks=[];let size=0;
      for await (const chunk of req) { size+=chunk.length;if(size>24000){send(413,{error:'REQUEST_TOO_LARGE'});return true;}chunks.push(chunk); }
      init.body=Buffer.concat(chunks);
    }
    const reqUrl=String(req.url||pathname),queryAt=reqUrl.indexOf('?'),suffix=queryAt>=0?reqUrl.slice(queryAt):'';
    const response=await fetch(WORKER_URL+pathname+suffix,init);
    const text=await response.text();
    res.statusCode=response.status;res.setHeader('Content-Type',(response.headers&&typeof response.headers.get==='function'&&response.headers.get('content-type'))||'application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(text);return true;
  } catch (_) { send(503,{error:'MARKETPLACE_WORKER_UNAVAILABLE'});return true; }
}
module.exports={handle};
