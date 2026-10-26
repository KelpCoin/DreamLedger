'use strict';

// Transitional HTTP adapter only. Persistence lives in the Neon-backed Cloudflare Worker.
const WORKER_URL = String(process.env.MARKETPLACE_WORKER_URL || '').replace(/\/$/, '');
async function handle(req,res,pathname) {
  if (pathname !== '/api/marketplace/intake') return false;
  const send=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));};
  if (req.method !== 'POST') { send(405,{error:'METHOD_NOT_ALLOWED'}); return true; }
  if (!WORKER_URL) { send(503,{error:'MARKETPLACE_WORKER_NOT_CONFIGURED'}); return true; }
  try {
    const chunks=[];let size=0;
    for await (const chunk of req) { size+=chunk.length;if(size>12000){send(413,{error:'REQUEST_TOO_LARGE'});return true;}chunks.push(chunk);}
    const response=await fetch(WORKER_URL+'/api/marketplace/intake',{method:'POST',headers:{'content-type':'application/json'},body:Buffer.concat(chunks)});
    const text=await response.text();res.statusCode=response.status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(text);return true;
  } catch (_) { send(503,{error:'MARKETPLACE_WORKER_UNAVAILABLE'});return true; }
}
module.exports={handle};
