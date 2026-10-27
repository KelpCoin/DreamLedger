// Preserve the legacy public URL used by the live billboard frontend.
import published from '../handlers/billboard-public.js';
export default async function handler(req:any,res:any) {
  try {
    const host=String(req.headers?.host||'dreamledger.org');
    const url=new URL(String(req.url||'/api/billboard-public'),'https://'+host);
    const upstream=await published(new Request(url.toString(),{method:String(req.method||'GET')}));
    res.statusCode=upstream.status;
    upstream.headers.forEach((v,k)=>res.setHeader(k,v));
    res.end(await upstream.text());
  } catch {
    res.statusCode=503;
    res.setHeader('content-type','application/json; charset=utf-8');
    res.setHeader('cache-control','no-store');
    res.end(JSON.stringify({error:'BILLBOARD_PUBLIC_MANIFEST_UNAVAILABLE'}));
  }
}
