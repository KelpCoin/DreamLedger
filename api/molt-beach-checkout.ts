const STRIPE_API='https://api.stripe.com/v1/checkout/sessions';
const SUPABASE_TABLE='molt_beach_campaigns';
const MARKETS:any={
 GLOBAL:{slug:'global',name:'Global Billboard',currency:'usd'},
 NZ:{slug:'nz',name:'New Zealand Billboard',currency:'nzd'},
 AU:{slug:'au',name:'Australia Billboard',currency:'aud'},
 ZA:{slug:'za',name:'South Africa Billboard',currency:'zar'},
 AMERICAS:{slug:'americas',name:'Americas Billboard',currency:'usd'},
 EUROPE:{slug:'europe',name:'Europe Billboard',currency:'eur'}
};
const OFFERS:any={
 '100x100':{sku:'BILLBOARD-SMALL',name:'DreamLedger Founding Tile - 100x100',price_nzd:50,amounts:{nzd:5000,aud:5000,zar:65000,usd:3000,eur:3000},w:100,h:100},
 '200x100':{sku:'BILLBOARD-MEDIUM',name:'DreamLedger Billboard Medium - 200x100',price_nzd:99,amounts:{nzd:9900,aud:9900,zar:130000,usd:6000,eur:6000},w:200,h:100},
 '500x200':{sku:'BILLBOARD-WIDE',name:'DreamLedger Billboard Wide - 500x200',price_nzd:249,amounts:{nzd:24900,aud:24900,zar:325000,usd:15000,eur:15000},w:500,h:200},
 '500x500':{sku:'BILLBOARD-LARGE',name:'DreamLedger Billboard Large - 500x500',price_nzd:499,amounts:{nzd:49900,aud:49900,zar:650000,usd:30000,eur:30000},w:500,h:500}
};
function json(data:any,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})}
function overlaps(x:number,y:number,w:number,h:number,c:any){return x<c.x+c.width&&x+w>c.x&&y<c.y+c.height&&y+h>c.y}
function findSlot(items:any[],w:number,h:number){for(let y=0;y<=1000-h;y+=10)for(let x=0;x<=1000-w;x+=10)if(!items.some((c:any)=>overlaps(x,y,w,h,c)))return{x,y};return null}
export default async function handler(request:Request){
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 const secret=process.env.STRIPE_SECRET_KEY;if(!secret)return json({error:'STRIPE_SECRET_KEY is not configured'},503);
 let body:any;try{body=await request.json()}catch{return json({error:'Invalid JSON'},400)}
 const w=Number(body.width),h=Number(body.height),offer=OFFERS[`${w}x${h}`];if(!offer)return json({error:'Unsupported billboard size'},400);
 const market=String(body.market||'GLOBAL').toUpperCase();const marketSpec=MARKETS[market];if(!marketSpec)return json({error:'Unsupported billboard market'},400);
 const email=String(body.email||'').trim();const title=String(body.title||'').trim();const owner_name=String(body.owner_name||'').trim();const image_url=String(body.image_url||'').trim();const destination_url=String(body.destination_url||'').trim();
 if(!/^\S+@\S+\.\S+$/.test(email))return json({error:'Invalid email'},400);if(!title||title.length>80)return json({error:'Title required, maximum 80 characters'},400);
 try{new URL(image_url);new URL(destination_url)}catch{return json({error:'Valid image URL and destination URL required'},400)}
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!base||!key)return json({error:'Supabase configuration missing'},503);
 const invUrl=base.replace(/\/$/,'')+'/rest/v1/'+SUPABASE_TABLE+'?market=eq.'+encodeURIComponent(market)+'&status=in.(PUBLISHED,PAID_PENDING_REVIEW)&select=x,y,width,height';
 const inv=await fetch(invUrl,{headers:{apikey:key,authorization:`Bearer ${key}`}});if(!inv.ok)return json({error:'Inventory unavailable'},503);
 const rows=await inv.json();const slot=findSlot(rows,offer.w,offer.h);if(!slot)return json({error:'No block of that size is currently available'},409);
 const currency=marketSpec.currency;const amount=Number(offer.amounts[currency]);
 const form=new URLSearchParams();form.set('mode','payment');form.set('line_items[0][price_data][currency]',currency);form.set('line_items[0][price_data][product_data][name]',offer.name+' - '+marketSpec.name);form.set('line_items[0][price_data][product_data][description]','Permanent digital billboard placement. Human review required before publication.');form.set('line_items[0][price_data][unit_amount]',String(amount));form.set('line_items[0][quantity]','1');form.set('success_url','https://dreamledger.org/billboard?paid=1&session_id={CHECKOUT_SESSION_ID}');form.set('cancel_url','https://dreamledger.org/billboard?cancelled=1');form.set('customer_email',email);
 form.set('metadata[molt_beach]','true');form.set('metadata[billboard]','true');form.set('metadata[sku]',offer.sku);form.set('metadata[market]',market);form.set('metadata[market_name]',marketSpec.name);form.set('metadata[x]',String(slot.x));form.set('metadata[y]',String(slot.y));form.set('metadata[width]',String(offer.w));form.set('metadata[height]',String(offer.h));form.set('metadata[price_nzd]',String(offer.price_nzd));form.set('metadata[currency]',currency);form.set('metadata[amount_minor]',String(amount));form.set('metadata[title]',title);form.set('metadata[owner_name]',owner_name.slice(0,80));form.set('metadata[image_url]',image_url);form.set('metadata[destination_url]',destination_url);
 const r=await fetch(STRIPE_API,{method:'POST',headers:{authorization:`Bearer ${secret}`,'content-type':'application/x-www-form-urlencoded'},body:form});const result=await r.json();if(!r.ok)return json({error:'Stripe checkout creation failed'},502);return json({url:result.url,session_id:result.id,sku:offer.sku,market,amount:amount/100,currency,slot});
}
