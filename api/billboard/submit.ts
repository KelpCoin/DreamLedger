const SIZE:any={small:{width:100,height:100},medium:{width:200,height:100},wide:{width:500,height:200},large:{width:500,height:500}};
const MARKETS:any={GLOBAL:'Global Billboard',NZ:'New Zealand Billboard',AU:'Australia Billboard',ZA:'South Africa Billboard',AMERICAS:'Americas Billboard',EUROPE:'Europe Billboard'};
function json(data:any,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})}
export default async function handler(request:Request){
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 let body:any;try{body=await request.json()}catch{return json({error:'Invalid JSON'},400)}
 const size=String(body.size||'small').toLowerCase();const spec=SIZE[size];if(!spec)return json({error:'Unsupported billboard size'},400);
 const market=String(body.market||'GLOBAL').toUpperCase();if(!MARKETS[market])return json({error:'Unsupported billboard market'},400);
 const email=String(body.email||'').trim();const title=String(body.title||'').trim();const owner_name=String(body.owner_name||'').trim();const destination_url=String(body.destination_url||'').trim();const image_url=String(body.image_url||'').trim();const image_requested=String(body.image_requested||'false').toLowerCase()==='true';
 if(!/^\S+@\S+\.\S+$/.test(email))return json({error:'Valid email required'},400);if(!title||title.length>80)return json({error:'Title required, maximum 80 characters'},400);
 try{new URL(destination_url)}catch{return json({error:'Valid destination URL required'},400)}
 if(image_requested){if(!image_url)return json({error:'Image URL required when Image Placement is selected'},400);try{new URL(image_url)}catch{return json({error:'Valid image URL required'},400)}}
 const origin=new URL(request.url).origin;const r=await fetch(origin+'/api/molt-beach-checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({width:spec.width,height:spec.height,market,email,title,owner_name,image_url,destination_url,image_requested})});const d=await r.json();if(!r.ok)return json(d,r.status);
 return json({checkout_url:d.url,session_id:d.session_id,market,size,slot:d.slot,amount:d.amount,currency:d.currency,image_requested,intake:{email,title,owner_name,image_url,destination_url}});
}
