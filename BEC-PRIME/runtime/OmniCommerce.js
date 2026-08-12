'use strict';

// File-backed MVP control plane for sellers, marketplace discovery and carts.
// Payment execution remains delegated to the existing approved checkout route.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const SELLERS = path.join(ROOT, 'catalog', 'sellers');
const PRODUCTS = path.join(ROOT, 'catalog', 'products');
const CART_DIR = path.join(ROOT, 'runtime-data', 'carts');
function send(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
function files(dir){return fs.existsSync(dir)?fs.readdirSync(dir).filter(x=>x.endsWith('.json')).map(x=>path.join(dir,x)):[];}
function read(f){return JSON.parse(fs.readFileSync(f,'utf8'));}
function loadSellers(){return files(SELLERS).map(read).filter(s=>s.status!=='suspended');}
function loadProducts(){return files(PRODUCTS).map(read).filter(p=>p.status==='published'&&p.commercial_truth&&p.commercial_truth.approval_required===false&&Number(p.inventory||0)>0);}
function publicSeller(s){return {id:s.id,slug:s.slug,name:s.name,description:s.description||'',plan:s.plan||'starter',status:s.status||'active'};}
function publicProduct(p){return {id:p.id,seller_id:p.seller_id||null,seller_slug:p.seller_slug||null,name:p.name,description:p.description||'',price:Number(p.price||0),currency:p.currency||'NZD',inventory:Number(p.inventory||0),silo:p.silo||'general',checkout_available:true};}
function parseBody(req){return new Promise((resolve,reject)=>{let data='';req.on('data',c=>{data+=c;if(data.length>200000)reject(new Error('Request too large'));});req.on('end',()=>{try{resolve(JSON.parse(data||'{}'));}catch(e){reject(e);}});req.on('error',reject);});}
function saveCart(cart){fs.mkdirSync(CART_DIR,{recursive:true});fs.writeFileSync(path.join(CART_DIR,cart.id+'.json'),JSON.stringify(cart,null,2)+'\n','utf8');}
function loadCart(id){const f=path.join(CART_DIR,id+'.json');return fs.existsSync(f)?read(f):null;}
async function handle(req,res){
  const p=String(req.url||'').split('?')[0];
  if(req.method==='GET'&&p==='/api/sellers') return send(res,200,{sellers:loadSellers().map(publicSeller)});
  if(req.method==='GET'&&p.startsWith('/api/sellers/')){const slug=p.slice('/api/sellers/'.length);const s=loadSellers().find(x=>x.slug===slug);if(!s)return send(res,404,{error:'Seller not found'});const products=loadProducts().filter(x=>x.seller_slug===slug||x.seller_id===s.id);return send(res,200,{seller:publicSeller(s),products:products.map(publicProduct)});}
  if(req.method==='GET'&&p==='/api/marketplace')return send(res,200,{products:loadProducts().map(publicProduct),sellers:loadSellers().map(publicSeller)});
  if(req.method==='GET'&&p==='/api/marketplace/categories'){const counts={};for(const x of loadProducts())counts[x.silo||'general']=(counts[x.silo||'general']||0)+1;return send(res,200,{categories:Object.entries(counts).map(([id,count])=>({id,count}))});}
  if(req.method==='GET'&&p==='/api/cart/status'){return send(res,400,{error:'Cart id required'});}
  if(req.method==='POST'&&p==='/api/cart'){
    try{const body=await parseBody(req);const items=Array.isArray(body.items)?body.items:[];if(!items.length)return send(res,400,{error:'Cart requires items'});const products=loadProducts();const normalized=[];for(const item of items){const product=products.find(x=>x.id===item.product_id);const qty=Math.max(1,Math.min(Number(item.quantity||1),Number(product?.inventory||0)));if(!product||qty<1)return send(res,409,{error:'Product unavailable',product_id:item.product_id});normalized.push({product_id:product.id,quantity:qty,seller_id:product.seller_id||product.seller_slug||null,unit_price:Number(product.price||0),currency:product.currency||'NZD'});}const sellerIds=[...new Set(normalized.map(x=>String(x.seller_id||'unknown')))];const id='cart_'+crypto.randomBytes(10).toString('hex');const cart={id,created_at:new Date().toISOString(),status:'open',seller_count:sellerIds.length,items:normalized};saveCart(cart);return send(res,201,cart);}catch(e){return send(res,400,{error:e.message||'Invalid cart'});}
  }
  if(req.method==='GET'&&p.startsWith('/api/cart/status/')){const id=p.slice('/api/cart/status/'.length);const cart=loadCart(id);return cart?send(res,200,cart):send(res,404,{error:'Cart not found'});}
  if(req.method==='POST'&&p==='/api/cart/checkout'){
    try{const body=await parseBody(req);const cart=loadCart(body.cart_id);if(!cart)return send(res,404,{error:'Cart not found'});if(cart.status!=='open')return send(res,409,{error:'Cart is not open'});const sellerIds=[...new Set(cart.items.map(x=>String(x.seller_id||'unknown')))];
      // Never fake a split-payment success. A single-seller cart can use the existing
      // approved checkout route; multi-seller carts expose the exact payment adapter boundary.
      if(sellerIds.length>1)return send(res,409,{error:'MULTI_VENDOR_PAYMENT_ADAPTER_REQUIRED',cart_id:cart.id,seller_count:sellerIds.length,next:'/api/cart/checkout'});
      cart.status='checkout_ready';cart.checkout_route='/api/offer-checkout/create';cart.checkout_items=cart.items.map(x=>x.product_id);saveCart(cart);return send(res,200,cart);
    }catch(e){return send(res,400,{error:e.message||'Checkout failed'});}
  }
  return false;
}
module.exports={handle};
