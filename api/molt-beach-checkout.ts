const STRIPE_API='https://api.stripe.com/v1/checkout/sessions';
const SUPABASE_TABLE='molt_beach_campaigns';
const FOUNDING_UNITS=100;
const MARKETS:any={
 GLOBAL:{slug:'global',name:'Global Billboard',currency:'usd'},
 NZ:{slug:'nz',name:'New Zealand Billboard',currency:'nzd'},
 AU:{slug:'au',name:'Australia Billboard',currency:'aud'},
 ZA:{slug:'za',name:'South Africa Billboard',currency:'zar'},
 AMERICAS:{slug:'americas',name:'Americas Billboard',currency:'usd'},
 EUROPE:{slug:'europe',name:'Europe Billboard',currency:'eur'}
};
const OFFERS:any={
 '100x100':{sku:'BILLBOARD-SMALL',name:'DreamLedger Founding Tile - 100x100',price_nzd:50,amounts:{nzd:5000,aud:4500,zar:50000,usd:3000,eur:2500},w:100,h:100},
 '200x100':{sku:'BILLBOARD-MEDIUM',name:'DreamLedger Billboard Medium - 200x100',price_nzd:99,amounts:{nzd:9900,aud:8300,zar:95000,usd:6000,eur:5100},w:200,h:100},
 '500x200':{sku:'BILLBOARD-WIDE',name:'DreamLedger Billboard Wide - 500x200',price_nzd:249,amounts:{nzd:24900,aud:20900,zar:240000,usd:14900,eur:12900},w:500,h:200},
 '500x500':{sku:'BILLBOARD-LARGE',name:'DreamLedger Billboard Large - 500x500',price_nzd:499,amounts:{nzd:49900,aud:41900,zar:480000,usd:29900,eur:25500},w:500,h:500}
};
const IMAGE_ADDON:any={nzd:10000,aud:8300,zar:100000,usd:6000,eur:5100};
function json(data:any,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})}
function overlaps(x:number,y:number,w:number,h:number,c:any){return x<c.x+c.width&&x+w>c.x&&y<c.y+c.height&&y+h>c.y}
function tileUnits(w:number,h:number){return Math.max(1,Math.ceil(w/100)*Math.ceil(h/100))}
function findSlot(items:any[],w:number,h:number){for(let y=0;y<=1000-h;y+=100)for(let x=0;x<=1000-w;x+=100)if(!items.some((c:any)=>overlaps(x,y,w,h,c)))return{x,y};return null}
export default async function handler(request:Request){
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 const secret=process.env.STRIPE_SECRET_KEY;if(!secret)return json({error:'STRIPE_SECRET_KEY is not configured'},503);
 let body:any;try{body=await request.json()}catch{return json({error:'Invalid JSON'},400)}
 const w=Number(body.width),h=Number(body.height),offer=OFFERS[`${w}x${h}`];if(!offer)return json({error:'Unsupported billboard size'},400);
 const market=String(body.market||'GLOBAL').toUpperCase();const marketSpec=MARKETS[market];if(!marketSpec)return json({error:'Unsupported billboard market'},400);
 const email=String(body.email||'').trim();const title=String(body.title||'').trim();const owner_name=String(body.owner_name||'').trim();const image_url=String(body.image_url||'').trim();const destination_url=String(body.destination_url||'').trim();const image_requested=Boolean(body.image_requested);
 if(!/^\S+@\S+\.\S+$/.test(email))return json({error:'Invalid email'},400);if(!title||title.length>80)return json({error:'Title required, maximum 80 characters'},400);
 try{new URL(destination_url)}catch{return json({error:'Valid destination URL required'},400)}
 if(image_requested){if(!image_url)return json({error:'Image URL required when Image Placement is selected'},400);try{new URL(image_url)}catch{return json({error:'Valid image URL required'},400)}}
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!base||!key)return json({error:'Supabase configuration missing'},503);
 const invUrl=base.replace(/\/$/,'')+'/rest/v1/'+SUPABASE_TABLE+'?market=eq.'+encodeURIComponent(market)+'&status=in.(PUBLISHED,PAID_PENDING_REVIEW)&select=x,y,width,height';
 const inv=await fetch(invUrl,{headers:{apikey:key,authorization:`Bearer ${key}`}});if(!inv.ok)return json({error:'Inventory unavailable'},503);
 const rows=await inv.json();const usedUnits=rows.reduce((n:any,c:any)=>n+tileUnits(Number(c.width),Number(c.height)),0);const neededUnits=tileUnits(offer.w,offer.h);if(usedUnits+neededUnits>FOUNDING_UNITS)return json({error:'This billboard size is sold out in this market'},409);const slot=findSlot(rows,offer.w,offer.h);if(!slot)return json({error:'No contiguous block of this size is currently available'},409);
 const currency=marketSpec.currency;const amount=Number(offer.amounts[currency]);const imageAmount=image_requested?Number(IMAGE_ADDON[currency]||0):0;
 const form=new URLSearchParams();form.set('mode','payment');form.set('line_items[0][price_data][currency]',currency);form.set('line_items[0][price_data][product_data][name]',offer.name+' - '+marketSpec.name);form.set('line_items[0][price_data][product_data][description]','Permanent digital billboard placement until January 1, 3000. Human review required before publication.');form.set('line_items[0][price_data][unit_amount]',String(amount));form.set('line_items[0][quantity]','1');
 if(image_requested){form.set('line_items[1][price_data][currency]',currency);form.set('line_items[1][price_data][product_data][name]','Image Placement + Human Approval');form.set('line_items[1][price_data][product_data][description]','Image placement add-on. Artwork is manually reviewed before publication.');form.set('line_items[1][price_data][unit_amount]',String(imageAmount));form.set('line_items[1][quantity]','1')}
 form.set('success_url','https://dreamledger.org/billboard?paid=1&session_id={CHECKOUT_SESSION_ID}');form.set('cancel_url','https://dreamledger.org/billboard?cancelled=1');form.set('customer_email',email);
 form.set('metadata[molt_beach]','true');form.set('metadata[billboard]','true');form.set('metadata[sku]',offer.sku);form.set('metadata[market]',market);form.set('metadata[market_name]',marketSpec.name);form.set('metadata[x]',String(slot.x));form.set('metadata[y]',String(slot.y));form.set('metadata[width]',String(offer.w));form.set('metadata[height]',String(offer.h));form.set('metadata[price_nzd]',String(offer.price_nzd));form.set('metadata[currency]',currency);form.set('metadata[amount_minor]',String(amount));form.set('metadata[tile_units]',String(neededUnits));form.set('metadata[image_requested]',String(image_requested));form.set('metadata[image_addon_minor]',String(imageAmount));form.set('metadata[title]',title);form.set('metadata[owner_name]',owner_name.slice(0,80));form.set('metadata[image_url]',image_requested?image_url:'');form.set('metadata[destination_url]',destination_url);
 const r=await fetch(STRIPE_API,{method:'POST',headers:{authorization:`Bearer ${secret}`,'content-type':'application/x-www-form-urlencoded'},body:form});const result=await r.json();if(!r.ok)return json({error:'Stripe checkout creation failed'},502);return json({url:result.url,session_id:result.id,sku:offer.sku,market,amount:(amount+imageAmount)/100,currency,image_requested,slot,inventory:{total_units:FOUNDING_UNITS,used_units:usedUnits,remaining_units:FOUNDING_UNITS-usedUnits-neededUnits}});
}
