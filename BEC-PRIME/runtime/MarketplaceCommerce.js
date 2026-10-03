'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const ROOT=path.join(__dirname,'..');
const DATA_ROOT=process.env.DREAMIEZ_DATA_DIR || ((fs.existsSync('/var/data')&&fs.statSync('/var/data').isDirectory())?'/var/data/dreamiez':path.join(ROOT,'data','dreamiez'));
const LISTINGS=path.join(DATA_ROOT,'marketplace-listings.json');
const ORDERS=path.join(DATA_ROOT,'marketplace-orders.json');
const OFFERS=path.join(DATA_ROOT,'marketplace-offers.json');
const CARTS=path.join(DATA_ROOT,'marketplace-carts.json');
const DISPUTES=path.join(DATA_ROOT,'marketplace-disputes.json');
const IDEMPOTENCY=path.join(DATA_ROOT,'marketplace-idempotency.json');
const USERS=path.join(DATA_ROOT,'users.json');
const LOCK=path.join(DATA_ROOT,'.marketplace-state.lock');

function read(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp-'+process.pid+'-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex');fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n','utf8');fs.renameSync(tmp,file);}
function sleep(ms){const end=Date.now()+ms;while(Date.now()<end){}}
function withLock(fn){
  fs.mkdirSync(DATA_ROOT,{recursive:true});
  let fd=null;
  for(let i=0;i<80;i++){
    try{fd=fs.openSync(LOCK,'wx');break}catch(e){if(e.code!=='EEXIST')throw e;sleep(25);}
  }
  if(fd===null)throw Object.assign(new Error('marketplace_state_busy'),{statusCode:503});
  try{return fn();}finally{try{fs.closeSync(fd)}catch{}try{fs.unlinkSync(LOCK)}catch{}}
}
function cookie(req,name){const m=String(req.headers.cookie||'').match(new RegExp('(?:^|;\\s*)'+name+'=([^;]+)'));return m?decodeURIComponent(m[1]):null;}
function userId(req){const id=cookie(req,'dreamiez_session');if(!id)return null;return read(USERS,[]).some(u=>u.id===id&&u.email)?id:null;}
function verifiedUser(req){const id=userId(req);if(!id)throw Object.assign(new Error('login required'),{statusCode:401});const u=read(USERS,[]).find(x=>x.id===id);if(!u||u.email_verified!==true)throw Object.assign(new Error('verified account required'),{statusCode:403});return{id,user:u};}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1000000)req.destroy();});req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch(e){reject(Object.assign(new Error('Invalid JSON'),{statusCode:400}));}});req.on('error',reject);});}
function json(res,status,data){if(res.writableEnded)return true;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));return true;}
function idem(req,b){return String(req.headers['idempotency-key']||b.idempotency_key||'').trim().slice(0,180);}
function remember(key,operation,response){
  if(!key)return;
  const items=read(IDEMPOTENCY,[]);
  const now=new Date().toISOString();
  items.push({key,operation,response,created_at:now});
  write(IDEMPOTENCY,items.slice(-5000));
}
function replay(key,operation){
  if(!key)return null;
  const hit=read(IDEMPOTENCY,[]).find(x=>x.key===key&&x.operation===operation);
  return hit?hit.response:null;
}
function idFn(prefix){return prefix+'_'+crypto.randomBytes(10).toString('hex');}
function qty(n){const q=Number(n);return Number.isInteger(q)&&q>0&&q<=1000?q:null;}
function offerPublic(o){return {id:o.id,listing_id:o.listing_id,buyer_id:o.buyer_id,seller_id:o.seller_id,amount_nzd:o.amount_nzd,quantity:o.quantity,status:o.status,expires_at:o.expires_at,created_at:o.created_at,updated_at:o.updated_at};}
function cartPublic(c){return {id:c.id,buyer_id:c.buyer_id,items:c.items,status:c.status,total_nzd:c.total_nzd,expires_at:c.expires_at,created_at:c.created_at,updated_at:c.updated_at};}

function reserveCart(ownerId,items,key){
  return withLock(()=>{
    const existing=key?replay(key,'cart_prepare'):null;if(existing)return existing;
    const listings=read(LISTINGS,[]),carts=read(CARTS,[]);
    const normalized=[];
    let total=0;
    for(const raw of Array.isArray(items)?items:[]){
      const listingId=String(raw&&raw.listing_id||'');
      const q=qty(raw&&raw.quantity||1);
      if(!listingId||!q)throw Object.assign(new Error('invalid_cart_item'),{statusCode:422});
      const listing=listings.find(x=>x.id===listingId&&x.status==='APPROVED');
      if(!listing)throw Object.assign(new Error('listing_not_found:'+listingId),{statusCode:404});
      if(listing.seller_id===ownerId)throw Object.assign(new Error('seller_cannot_buy_own_listing'),{statusCode:403});
      const available=Number(listing.quantity||0)-Number(listing.reserved||0)-Number(listing.sold||0);
      if(available<q)throw Object.assign(new Error('insufficient_inventory:'+listingId),{statusCode:409});
      listing.reserved=Number(listing.reserved||0)+q;
      total+=Number(listing.price||0)*q;
      normalized.push({listing_id:listing.id,quantity:q,unit_price_nzd:Number(listing.price||0),title:listing.title,seller_id:listing.seller_id});
    }
    if(!normalized.length)throw Object.assign(new Error('cart_items_required'),{statusCode:422});
    const now=new Date(),expires=new Date(now.getTime()+15*60*1000).toISOString();
    const cart={id:idFn('cart'),buyer_id:ownerId,items:normalized,total_nzd:Math.round(total*100)/100,status:'RESERVED',expires_at:expires,created_at:now.toISOString(),updated_at:now.toISOString()};
    carts.push(cart);write(LISTINGS,listings);write(CARTS,carts);
    const response={ok:true,cart:cartPublic(cart),commercial_truth:'CART_RESERVED_NOT_REVENUE'};
    remember(key,'cart_prepare',response);
    return response;
  });
}

async function handle(req,res,url){
  if(!url.startsWith('/api/marketplace/v2/'))return false;

  if(req.method==='GET'&&url==='/api/marketplace/v2/capabilities'){
    return json(res,200,{schema:'dreamledger-marketplace-capabilities/v2',version:2,fees:{listing_nzd:0,success_nzd:0,buyer_mandatory_nzd:0},commerce:{catalogue:true,cart_prepare:true,offers:true,checkout:true,shipping:true,disputes:true,reputation:true},agent:{discovery:true,cart_prepare:true,purchase_requires_explicit_authorization:true,scopes:['DISCOVERY','CART_PREPARE','PURCHASE_AUTHORIZE']},idempotency:true,inventory_reservation:{enabled:true,ttl_minutes:15},truth:{settled_payment_required:true,fulfillment_required:true,independent_evidence_required:true}});
  }

  if(req.method==='POST'&&url==='/api/marketplace/v2/cart/prepare'){
    try{
      const {id:userId}=verifiedUser(req),b=await body(req),key=idem(req,b);
      return json(res,201,reserveCart(userId,b.items,key));
    }catch(e){return json(res,e.statusCode||400,{error:e.message});}
  }

  const cartMatch=url.match(/^\/api\/marketplace\/v2\/cart\/([^/]+)$/);
  if(req.method==='GET'&&cartMatch){
    try{const {id:userId}=verifiedUser(req),cart=read(CARTS,[]).find(x=>x.id===decodeURIComponent(cartMatch[1])&&x.buyer_id===userId);return cart?json(res,200,{cart:cartPublic(cart)}):json(res,404,{error:'cart_not_found'});}catch(e){return json(res,e.statusCode||400,{error:e.message});}
  }

  if(req.method==='POST'&&url==='/api/marketplace/v2/offers'){
    try{
      const {id:userId}=verifiedUser(req),b=await body(req),key=idem(req,b);
      const prior=replay(key,'offer_create');if(prior)return json(res,200,prior);
      const listingId=String(b.listing_id||''),amount=Number(b.amount_nzd),quantity=qty(b.quantity||1);
      if(!listingId||!Number.isFinite(amount)||amount<=0||!quantity)return json(res,422,{error:'listing_id, positive amount_nzd and valid quantity required'});
      const response=withLock(()=>{
        const listings=read(LISTINGS,[]),offers=read(OFFERS,[]),listing=listings.find(x=>x.id===listingId&&x.status==='APPROVED');
        if(!listing)return {error:'listing_not_found'};
        if(listing.seller_id===userId)return {error:'seller_cannot_offer_on_own_listing'};
        const now=new Date(),o={id:idFn('off'),listing_id:listingId,buyer_id:userId,seller_id:listing.seller_id,amount_nzd:Math.round(amount*100)/100,quantity,status:'PENDING_SELLER',expires_at:new Date(now.getTime()+48*60*60*1000).toISOString(),created_at:now.toISOString(),updated_at:now.toISOString()};
        offers.push(o);write(OFFERS,offers);const out={ok:true,offer:offerPublic(o),commercial_truth:'OFFER_PENDING_NOT_REVENUE'};remember(key,'offer_create',out);return out;
      });
      if(response.error)return json(res,response.error==='listing_not_found'?404:403,response);
      return json(res,201,response);
    }catch(e){return json(res,e.statusCode||400,{error:e.message});}
  }

  const offerMatch=url.match(/^\/api\/marketplace\/v2\/offers\/([^/]+)$/);
  if(req.method==='GET'&&offerMatch){
    try{const {id:userId}=verifiedUser(req),o=read(OFFERS,[]).find(x=>x.id===decodeURIComponent(offerMatch[1])&&(x.buyer_id===userId||x.seller_id===userId));return o?json(res,200,{offer:offerPublic(o)}):json(res,404,{error:'offer_not_found'});}catch(e){return json(res,e.statusCode||400,{error:e.message});}
  }
  if(req.method==='POST'&&offerMatch){
    try{
      const {id:userId}=verifiedUser(req),b=await body(req),action=String(b.action||'').toUpperCase();
      if(!['ACCEPT','DECLINE','COUNTER','CANCEL'].includes(action))return json(res,422,{error:'action must be ACCEPT, DECLINE, COUNTER or CANCEL'});
      const result=withLock(()=>{
        const offers=read(OFFERS,[]),o=offers.find(x=>x.id===decodeURIComponent(offerMatch[1]));if(!o)return {status:404,error:'offer_not_found'};
        const sellerAction=userId===o.seller_id,buyerAction=userId===o.buyer_id;if(!sellerAction&&!buyerAction)return {status:403,error:'not_a_party'};
        if(o.status!=='PENDING_SELLER'&&o.status!=='PENDING_BUYER')return {status:409,error:'offer_not_actionable'};
        const now=new Date().toISOString();
        if(action==='ACCEPT'){o.status='ACCEPTED';o.accepted_by=userId;o.updated_at=now;}
        else if(action==='DECLINE'||action==='CANCEL'){if(action==='DECLINE'&&!sellerAction)return {status:403,error:'only_seller_can_decline'};if(action==='CANCEL'&&!buyerAction)return {status:403,error:'only_buyer_can_cancel'};o.status=action==='DECLINE'?'DECLINED':'CANCELLED';o.updated_at=now;}
        else {const amount=Number(b.amount_nzd);if(!sellerAction||!Number.isFinite(amount)||amount<=0)return {status:422,error:'seller counter requires positive amount_nzd'};o.amount_nzd=Math.round(amount*100)/100;o.status='PENDING_BUYER';o.updated_at=now;}
        write(OFFERS,offers);return {status:200,offer:offerPublic(o),commercial_truth:o.status==='ACCEPTED'?'ACCEPTED_OFFER_NOT_PAID':'OFFER_STATE_ONLY'};
      });
      return json(res,result.status||200,result.status&&result.error?{error:result.error}:result);
    }catch(e){return json(res,e.statusCode||400,{error:e.message});}
  }

  if(req.method==='GET'&&url==='/api/marketplace/v2/disputes'){
    try{const {id:userId}=verifiedUser(req),items=read(DISPUTES,[]).filter(x=>x.buyer_id===userId||x.seller_id===userId);return json(res,200,{items});}catch(e){return json(res,e.statusCode||400,{error:e.message});}
  }
  if(req.method==='POST'&&url==='/api/marketplace/v2/disputes'){
    try{
      const {id:userId}=verifiedUser(req),b=await body(req),orderId=String(b.order_id||''),reason=String(b.reason||'').trim().slice(0,1000);
      if(!orderId||!reason)return json(res,422,{error:'order_id and reason required'});
      const result=withLock(()=>{
        const orders=read(ORDERS,[]),o=orders.find(x=>x.id===orderId&&(x.buyer_id===userId||x.seller_id===userId));if(!o)return {status:404,error:'order_not_found'};
        const items=read(DISPUTES,[]);if(items.some(x=>x.order_id===orderId&&x.status==='OPEN'))return {status:409,error:'open_dispute_exists'};
        const d={id:idFn('dsp'),order_id:orderId,buyer_id:o.buyer_id,seller_id:o.seller_id,opened_by:userId,reason,status:'OPEN',resolution:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};items.push(d);write(DISPUTES,items);o.dispute_status='OPEN';write(ORDERS,orders);return {ok:true,dispute:d,commercial_truth:'DISPUTE_OPEN_NOT_REFUNDED'};
      });
      return json(res,result.status||201,result.error?{error:result.error}:result);
    }catch(e){return json(res,e.statusCode||400,{error:e.message});}
  }

  if(req.method==='GET'&&url==='/api/marketplace/v2/agent-access/manifest'){
    return json(res,200,{schema:'dreamledger-agent-commerce/v2',authority:'explicit_human_authorization_required',scopes:{DISCOVERY:'read catalogue',CART_PREPARE:'reserve cart inventory for 15 minutes',PURCHASE_AUTHORIZE:'may create a payment action only after separately approved authority'},safety:{no_self_purchase:true,no_secret_exposure:true,no_implicit_purchase:true,no_authority_escalation:true},idempotency:{required_for_mutations:true}});
  }
  return false;
}

module.exports={handle,reserveCart,withLock,paths:{LISTINGS,ORDERS,OFFERS,CARTS,DISPUTES,IDEMPOTENCY}};
