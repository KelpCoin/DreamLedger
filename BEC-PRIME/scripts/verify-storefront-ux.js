'use strict';

const http = require('http');
const PORT = Number(process.env.PORT || 4173);
const BASE = 'http://127.0.0.1:' + PORT;
function get(pathname) { return new Promise((resolve, reject) => { const req=http.get(BASE+pathname,{headers:{'cache-control':'no-cache'}},res=>{let body='';res.setEncoding('utf8');res.on('data',c=>{body+=c});res.on('end',()=>resolve({status:res.statusCode||0,headers:res.headers,body}))});req.on('error',reject);req.setTimeout(10000,()=>req.destroy(new Error('timeout: '+pathname)))}) }
async function main(){
 const home=await get('/'); if(home.status!==200)throw new Error('homepage status '+home.status); const html=home.body;
 const required=[['DreamLedger',/DreamLedger/i],['Internet Garden headline',/THE INTERNET\s*<[^>]*>IS A GARDEN|THE INTERNET IS A GARDEN/i],['plant CTA',/Plant a plot/i],['billboard route',/href="\/billboard"/i],['garden route',/href="\/billboard"/i],['gardeners route',/href="\/dreammeez"/i],['billboard price',/NZ\$50/i],['agent shopping language',/shopping agents/i]];
 for(const [label,pattern] of required){if(!pattern.test(html))throw new Error('missing '+label+' on homepage')}
 const forbidden=['Gauntlet','Economic Court','ELOHIM','BrownEye Cortex','BEC-PRIME','AMPLISSA','COLLECTORSCOAST','SUPABASE_SERVICE_ROLE','STRIPE_SECRET','STRIPE_WEBHOOK','RA_000001','capital authority','Dream Ledger Deck'];
 for(const token of forbidden){if(html.toLowerCase().includes(token.toLowerCase()))throw new Error('forbidden public copy: '+token)}
 const products=await get('/api/products'); if(products.status!==200)throw new Error('/api/products status '+products.status); let parsed;try{parsed=JSON.parse(products.body)}catch(e){throw new Error('/api/products returned invalid JSON: '+e.message)}
 if(!parsed||!Array.isArray(parsed.products))throw new Error('/api/products JSON has no products[] array');
 const published=parsed.products.filter(p=>p&&p.status==='published'); const unavailable=published.filter(p=>p.checkout_available===false); if(unavailable.length)throw new Error('published products without checkout: '+unavailable.map(p=>p.id).join(', '));
 console.log(JSON.stringify({status:'PASS',timestamp_utc:new Date().toISOString(),homepage_status:home.status,products_status:products.status,required_markers:required.map(x=>x[0]),forbidden_public_copy_checked:forbidden,published_products:published.length,buyable_published_products:published.length,products_json_valid:true},null,2));
}
main().catch(e=>{console.error('STOREFRONT_UX_GATE_FAILED: '+(e.stack||e.message));process.exit(1)});
