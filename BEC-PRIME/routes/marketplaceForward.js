'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const ROOT=path.join(__dirname,'..');
const DATA_ROOT=process.env.DREAMIEZ_DATA_DIR || ((fs.existsSync('/var/data')&&fs.statSync('/var/data').isDirectory())?'/var/data/dreamiez':path.join(ROOT,'data','dreamiez'));
const USERS=path.join(DATA_ROOT,'users.json');
const LISTINGS=path.join(DATA_ROOT,'marketplace-listings.json');
const SOCIAL=name=>path.join(DATA_ROOT,name+'.json');
const STRIPE_SECRET=String(process.env.STRIPE_SECRET_KEY||process.env.STRIPE_LIVE_SECRET_KEY||'');
const PUBLIC_BASE=String(process.env.PUBLIC_BASE_URL||'https://dreamledger.org').replace(/\/$/,'');
const BLOCKED=/\b(stolen|counterfeit|weapons?|firearms?|ammunition|explosives?|illegal drugs?|child sexual|csam)\b/i;

function read(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp-'+process.pid+'-'+Date.now();fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n');fs.renameSync(tmp,file);}
function cookie(req,name){const m=String(req.headers.cookie||'').match(new RegExp('(?:^|;\\s*)'+name+'=([^;]+)'));return m?decodeURIComponent(m[1]):null;}
function sessionUser(req){const id=cookie(req,'dreamiez_session');if(!id)return null;return read(USERS,[]).find(u=>u.id===id&&u.email)?id:null;}
function publicListing(x){return{id:x.id,seller_id:x.seller_id,seller_name:x.seller_name,title:x.title,description:x.description,category:x.category,price:x.price,currency:x.currency||'NZD',condition:x.condition,location:x.location,photos:x.photos||[],status:x.status,quantity:x.quantity||1,reserved:x.reserved||0,created_at:x.created_at,moderation:x.moderation||'AUTO_APPROVED'};}
function json(res,status,data){if(res.writableEnded)return true;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));return true;}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1000000)req.destroy();});req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch(e){reject(Object.assign(new Error('Invalid JSON'),{statusCode:400}));}});req.on('error',reject);});}
function requireUser(req){const id=sessionUser(req);if(!id)throw Object.assign(new Error('login required'),{statusCode:401});return id;}
function requireVerified(req){const id=requireUser(req);const u=read(USERS,[]).find(x=>x.id===id);if(!u||u.email_verified!==true)throw Object.assign(new Error('verified account required'),{statusCode:403});return{id,user:u};}
function stripeForm(values){const form=new URLSearchParams();for(const [k,v] of Object.entries(values))form.set(k,String(v));return form;}
function checkoutPayload(listing,orderId,email){
 return stripeForm({
  mode:'payment',client_reference_id:orderId,customer_email:email||'',
  'line_items[0][price_data][currency]':'nzd',
  'line_items[0][price_data][unit_amount]':Math.round(Number(listing.price)*100),
  'line_items[0][price_data][product_data][name]':String(listing.title).slice(0,120),
  'line_items[0][price_data][product_data][description]':String(listing.description||'').slice(0,500),
  'line_items[0][quantity]':1,
  success_url:PUBLIC_BASE+'/marketplace-forward.html?checkout=success&session_id={CHECKOUT_SESSION_ID}',
  cancel_url:PUBLIC_BASE+'/marketplace-forward.html?checkout=cancelled&order_id='+orderId,
  'metadata[dreamledger_sku]':'MARKETPLACE-LISTING',
  'metadata[marketplace_listing_id]':listing.id,
  'metadata[marketplace_order_id]':orderId,
  'metadata[silo]':'MARKETPLACE'
 });
}
async function stripeCheckout(listing,orderId,email){
 if(!STRIPE_SECRET)throw Object.assign(new Error('Stripe checkout is not configured'),{statusCode:503});
 const r=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:'Bearer '+STRIPE_SECRET,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':'dreamledger-marketplace-'+orderId},body:checkoutPayload(listing,orderId,email)});
 const raw=await r.text();let d;try{d=JSON.parse(raw||'{}')}catch{d={}};
 if(!r.ok)throw Object.assign(new Error(d?.error?.message||'Stripe checkout creation failed'),{statusCode:502});
 return d;
}
async function handle(req,res,url){
 if(!url.startsWith('/api/marketplace/v2/'))return false;
 try{
  if(req.method==='GET'&&url==='/api/marketplace/v2/manifest')return json(res,200,{schema:'dreamledger/marketplace-forward/v1',fees:{listing_nzd:0,success_nzd:0,buyer_mandatory_nzd:0},payment:'Stripe',fulfillment:'external-payment -> evidence -> reputation',status:'LIVE_CODE_PATH'});
  if(req.method==='GET'&&url==='/api/marketplace/v2/listings'){
   const u=new URL(req.url,'http://localhost'),q=String(u.searchParams.get('q')||'').trim().toLowerCase(),cat=String(u.searchParams.get('category')||'').trim().toLowerCase(),sort=String(u.searchParams.get('sort')||'new'),limit=Math.min(100,Math.max(1,Number(u.searchParams.get('limit')||40))),offset=Math.max(0,Number(u.searchParams.get('offset')||0));
   let items=read(LISTINGS,[]).filter(x=>x.status==='APPROVED').filter(x=>{const hay=[x.title,x.description,x.category,x.seller_name,x.location].join(' ').toLowerCase();return(!q||hay.includes(q))&&(!cat||String(x.category||'').toLowerCase()===cat)}).map(publicListing);
   if(sort==='price_asc')items.sort((a,b)=>a.price-b.price);else if(sort==='price_desc')items.sort((a,b)=>b.price-a.price);else items.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
   return json(res,200,{items:items.slice(offset,offset+limit),total:items.length,offset,limit,categories:[...new Set(items.map(x=>x.category).filter(Boolean))].sort()});
  }
  if(req.method==='GET'&&url==='/api/marketplace/v2/my-listings'){const id=requireUser(req);return json(res,200,{items:read(LISTINGS,[]).filter(x=>x.seller_id===id).map(publicListing)});}
  if(req.method==='POST'&&url==='/api/marketplace/v2/listings'){
   const {id,user}=requireVerified(req),b=await body(req),title=String(b.title||'').trim().slice(0,120),description=String(b.description||'').trim().slice(0,3000),category=String(b.category||'General').trim().slice(0,80),condition=String(b.condition||'').trim().slice(0,50),location=String(b.location||'NZ').trim().slice(0,120),price=Number(b.price),quantity=Math.min(1000,Math.max(1,Number(b.quantity||1)));
   if(!title||!description||!Number.isFinite(price)||price<=0)return json(res,422,{error:'title, description and positive price are required'});
   if(BLOCKED.test(title+' '+description))return json(res,422,{error:'listing blocked by automated safety gate'});
   const listings=read(LISTINGS,[]),item={id:'lst_'+crypto.randomBytes(8).toString('hex'),seller_id:id,seller_name:user.seller?.display_name||user.name||'Dreamer',title,description,category,condition,location,price:Math.round(price*100)/100,currency:'NZD',quantity,reserved:0,status:'APPROVED',moderation:'AUTO_APPROVED',checkout_available:true,photos:Array.isArray(b.photos)?b.photos.slice(0,12):[],created_at:new Date().toISOString()};
   listings.push(item);write(LISTINGS,listings);return json(res,201,{ok:true,item:publicListing(item)});
  }
  if(req.method==='POST'&&url==='/api/marketplace/v2/orders/create'){
   const {id,user}=requireVerified(req),b=await body(req),listingId=String(b.listing_id||''),listings=read(LISTINGS,[]),listing=listings.find(x=>x.id===listingId&&x.status==='APPROVED');
   if(!listing)return json(res,404,{error:'listing not found'});if(listing.seller_id===id)return json(res,403,{error:'seller cannot buy own listing'});if(Number(listing.reserved||0)>=Number(listing.quantity||1))return json(res,409,{error:'listing currently reserved'});
   const file=SOCIAL('marketplace-orders'),orders=read(file,[]),order={id:'mkt_'+crypto.randomBytes(8).toString('hex'),listing_id:listing.id,buyer_id:id,buyer_name:user.name||'Buyer',seller_id:listing.seller_id,seller_name:listing.seller_name,title:listing.title,total_nzd:listing.price,currency:'NZD',status:'PENDING_PAYMENT',payment_status:'UNPAID',fulfilment_status:'NOT_STARTED',delivery_status:'NOT_STARTED',evidence_status:'UNPROVEN',marketplace_fee_nzd:0,created_at:new Date().toISOString()};
   orders.push(order);listing.reserved=Number(listing.reserved||0)+1;write(file,orders);write(LISTINGS,listings);
   try{const session=await stripeCheckout(listing,order.id,user.email);order.stripe_checkout_session=session.id;order.checkout_url=session.url;write(file,orders);return json(res,201,{ok:true,order,checkout_url:session.url,commercial_truth:'PAYMENT_PENDING_NOT_REVENUE'});}
   catch(e){listing.reserved=Math.max(0,Number(listing.reserved||0)-1);write(LISTINGS,listings);orders.splice(orders.findIndex(x=>x.id===order.id),1);write(file,orders);throw e;}
  }
  if(req.method==='GET'&&url==='/api/marketplace/v2/orders'){const id=requireUser(req);return json(res,200,{items:read(SOCIAL('marketplace-orders'),[]).filter(x=>x.buyer_id===id||x.seller_id===id)});}
  if(req.method==='POST'&&url==='/api/marketplace/v2/orders/evidence'){const id=requireUser(req),b=await body(req),file=SOCIAL('marketplace-orders'),items=read(file,[]),o=items.find(x=>x.id===String(b.order_id||'')&&(x.buyer_id===id||x.seller_id===id));if(!o)return json(res,404,{error:'order not found'});o.evidence_status='SUBMITTED';o.evidence={by:id,type:String(b.type||'OTHER').slice(0,40),reference:String(b.reference||'').slice(0,500),at:new Date().toISOString()};write(file,items);return json(res,200,{ok:true,order:o});}
  if(req.method==='GET'&&url==='/api/marketplace/v2/messages'){const id=requireUser(req);return json(res,200,{items:read(SOCIAL('messages'),[]).filter(x=>x.from_user_id===id||x.to_user_id===id)});}
  if(req.method==='POST'&&url==='/api/marketplace/v2/messages'){const id=requireUser(req),b=await body(req),to=String(b.to_user_id||''),message=String(b.message||'').trim().slice(0,4000);if(!to||!message)return json(res,422,{error:'recipient and message required'});const file=SOCIAL('messages'),items=read(file,[]),item={id:'msg_'+crypto.randomBytes(8).toString('hex'),from_user_id:id,to_user_id:to,listing_id:b.listing_id?String(b.listing_id):null,message,created_at:new Date().toISOString(),read:false};items.push(item);write(file,items);return json(res,201,{ok:true,item});}
  if(req.method==='POST'&&url==='/api/marketplace/v2/favorites'){const id=requireUser(req),b=await body(req),file=SOCIAL('favorites'),items=read(file,[]).filter(x=>!(x.user_id===id&&x.listing_id===String(b.listing_id||'')));if(b.action!=='remove')items.push({id:'fav_'+crypto.randomBytes(8).toString('hex'),user_id:id,listing_id:String(b.listing_id||''),created_at:new Date().toISOString()});write(file,items);return json(res,200,{ok:true,favorited:b.action!=='remove'});}
  if(req.method==='GET'&&url==='/api/marketplace/v2/favorites'){const id=requireUser(req);return json(res,200,{items:read(SOCIAL('favorites'),[]).filter(x=>x.user_id===id)});}
  const seller=url.match(/^\/api\/marketplace\/v2\/sellers\/([^/]+)$/);if(req.method==='GET'&&seller){const sid=decodeURIComponent(seller[1]),u=read(USERS,[]).find(x=>x.id===sid),reviews=read(SOCIAL('reviews'),[]).filter(x=>x.seller_id===sid);return json(res,200,{seller:u?{id:u.id,name:u.seller?.display_name||u.name,location:u.seller?.location||'',bio:u.seller?.bio||'',avatar:u.avatar||null}:null,reviews,average_rating:reviews.length?reviews.reduce((n,x)=>n+Number(x.rating||0),0)/reviews.length:0});}
  if(req.method==='POST'&&url==='/api/marketplace/v2/reviews'){const id=requireVerified(req),b=await body(req),order=read(SOCIAL('marketplace-orders'),[]).find(x=>x.id===String(b.order_id||'')&&x.buyer_id===id&&x.payment_status==='PAID');if(!order)return json(res,403,{error:'verified paid purchase required'});const file=SOCIAL('reviews'),items=read(file,[]);if(items.some(x=>x.reviewer_id===id&&x.order_id===order.id))return json(res,409,{error:'review already exists'});const rating=Math.max(1,Math.min(5,Math.round(Number(b.rating))));const item={id:'rev_'+crypto.randomBytes(8).toString('hex'),reviewer_id:id,order_id:order.id,seller_id:order.seller_id,listing_id:order.listing_id,rating,text:String(b.text||'').trim().slice(0,1000),created_at:new Date().toISOString()};items.push(item);write(file,items);return json(res,201,{ok:true,item});}
  if(req.method==='POST'&&url==='/api/marketplace/v2/reports'){const id=requireUser(req),b=await body(req),reason=String(b.reason||'').trim().slice(0,120),details=String(b.details||'').trim().slice(0,2000);if(!reason)return json(res,422,{error:'reason required'});const file=SOCIAL('reports'),items=read(file,[]),item={id:'rpt_'+crypto.randomBytes(8).toString('hex'),reporter_id:id,listing_id:b.listing_id?String(b.listing_id):null,user_id:b.user_id?String(b.user_id):null,reason,details,status:'OPEN',created_at:new Date().toISOString()};items.push(item);write(file,items);return json(res,201,{ok:true,item});}
  return json(res,404,{error:'unknown marketplace v2 route'});
 }catch(e){return json(res,e.statusCode||500,{error:e.message||'marketplace error'});}
}
module.exports={handle};
