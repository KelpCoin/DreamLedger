const STRIPE_API='https://api.stripe.com/v1/checkout/sessions';
const SUPABASE_TABLE='molt_beach_campaigns';
const OFFERS:any={
 '100x100':{sku:'MOLT-BEACH-100X100',name:'Molt Beach 100x100 billboard block',amount:2900,w:100,h:100},
 '200x100':{sku:'MOLT-BEACH-200X100',name:'Molt Beach 200x100 billboard block',amount:7900,w:200,h:100},
 '500x200':{sku:'MOLT-BEACH-500X200',name:'Molt Beach 500x200 billboard block',amount:14900,w:500,h:200},
 '500x500':{sku:'MOLT-BEACH-500X500',name:'Molt Beach 500x500 billboard block',amount:34900,w:500,h:500},
 '1000x1000':{sku:'MOLT-BEACH-1000X1000',name:'Molt Beach full-canvas takeover',amount:99900,w:1000,h:1000}
};
function json(data:any,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})}
async function occupied(x:number,y:number,w:number,h:number){
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key) throw new Error('Supabase configuration missing');
 const url=base.replace(/\/$/,'')+'/rest/v1/'+SUPABASE_TABLE+'?status=in.(PUBLISHED,PAID_PENDING_REVIEW)&select=x,y,width,height';
 const r=await fetch(url,{headers:{apikey:key,authorization:`Bearer ${key}`}});if(!r.ok)throw new Error('Inventory lookup failed');
 const rows=await r.json();
 return rows.some((c:any)=>x<c.x+c.width&&x+w>c.x&&y<c.y+c.height&&y+h>c.y);
}
function findSlot(items:any[],w:number,h:number){
 for(let y=0;y<=1000-h;y+=10) for(let x=0;x<=1000-w;x+=10) if(!items.some((c:any)=>x<c.x+c.width&&x+w>c.x&&y<c.y+c.height&&y+h>c.y)) return {x,y};
 return null;
}
export default async function handler(request:Request){
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 const secret=process.env.STRIPE_SECRET_KEY;if(!secret)return json({error:'STRIPE_SECRET_KEY is not configured'},503);
 let body:any;try{body=await request.json()}catch{return json({error:'Invalid JSON'},400)}
 const w=Number(body.width),h=Number(body.height),offer=OFFERS[`${w}x${h}`];if(!offer)return json({error:'Unsupported Molt Beach size'},400);
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!base||!key)return json({error:'Supabase configuration missing'},503);
 const invUrl=base.replace(/\/$/,'')+'/rest/v1/'+SUPABASE_TABLE+'?status=in.(PUBLISHED,PAID_PENDING_REVIEW)&select=x,y,width,height';
 const inv=await fetch(invUrl,{headers:{apikey:key,authorization:`Bearer ${key}`}});if(!inv.ok)return json({error:'Inventory unavailable'},503);
 const rows=await inv.json();const slot=findSlot(rows,w,h);if(!slot)return json({error:'No block of that size is currently available'},409);
 if(await occupied(slot.x,slot.y,w,h))return json({error:'Selected inventory changed; retry'},409);
 const form=new URLSearchParams();form.set('mode','payment');form.set('line_items[0][price_data][currency]','nzd');form.set('line_items[0][price_data][product_data][name]',offer.name);form.set('line_items[0][price_data][unit_amount]',String(offer.amount));form.set('line_items[0][quantity]','1');form.set('success_url','https://dreamledger.org/board?paid=1&session_id={CHECKOUT_SESSION_ID}');form.set('cancel_url','https://dreamledger.org/board?cancelled=1');
 form.set('metadata[molt_beach]','true');form.set('metadata[sku]',offer.sku);form.set('metadata[x]',String(slot.x));form.set('metadata[y]',String(slot.y));form.set('metadata[width]',String(w));form.set('metadata[height]',String(h));
 const r=await fetch(STRIPE_API,{method:'POST',headers:{authorization:`Bearer ${secret}`,'content-type':'application/x-www-form-urlencoded'},body:form});const result=await r.json();if(!r.ok)return json({error:'Stripe checkout creation failed'},502);return json({url:result.url,session_id:result.id,sku:offer.sku,amount_nzd:offer.amount/100,slot});
}
