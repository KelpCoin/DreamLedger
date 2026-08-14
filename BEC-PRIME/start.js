'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const dreamiezAccount = require('./dreamiez-account');
const frontDoor = require('./routes/frontDoor');
const accountRecovery = require('./routes/accountRecovery');
const marketplaceWebhook = require('./routes/marketplaceWebhook');
const controlPlane = require('./runtime/ControlPlane');
const demandRadar = require('./runtime/DemandRadar');
const sentinel = require('./runtime/Sentinel');
const digitalProxyAssistant = require('./proxy/DigitalProxyAssistant');
const omniCommerce = require('./routes/omniCommerce');
const platformCart = require('./routes/platformCart');
const originalWriteHead = http.ServerResponse.prototype.writeHead;
const originalEnd = http.ServerResponse.prototype.end;
http.ServerResponse.prototype.writeHead = function(...args){if(this.headersSent)return this;return originalWriteHead.apply(this,args)};
http.ServerResponse.prototype.end = function(...args){if(this.writableEnded)return this;return originalEnd.apply(this,args)};
const originalCreateServer = http.createServer;
let capturedServer = null;
const PRODUCT_CATALOG = path.join(__dirname, 'catalog', 'products');
const OFFER_CATALOG = path.join(__dirname, 'catalog', 'offers', 'offers.json');
const APPROVED_OFFER_CATALOG = path.join(__dirname, 'catalog', 'offers', 'approved.json');
const PORT = Number(process.env.PORT || 3000);
const DREAMIEZ_ROOT = path.join(__dirname, 'silos', 'SILO_DREAMIEZ', 'compiled', 'website');
const DREAMIEZ_MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml'};
function jsonBody(req){return new Promise((resolve,reject)=>{let data='';req.on('data',chunk=>{data+=chunk;if(data.length>200000)req.destroy(new Error('Request too large'))});req.on('end',()=>{try{resolve(JSON.parse(data||'{}'))}catch(err){reject(err)}});req.on('error',reject)})}
function send(res,status,body){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body))}
function loadApprovedProducts(){if(!fs.existsSync(PRODUCT_CATALOG))return[];return fs.readdirSync(PRODUCT_CATALOG).filter(name=>name.endsWith('.json')).map(name=>JSON.parse(fs.readFileSync(path.join(PRODUCT_CATALOG,name),'utf8'))).filter(product=>product.status==='published'&&product.commercial_truth&&product.commercial_truth.approval_required===false)}
function loadVerifiedOffers(){if(!fs.existsSync(OFFER_CATALOG))return[];const catalog=JSON.parse(fs.readFileSync(OFFER_CATALOG,'utf8'));const offers=Array.isArray(catalog.offers)?catalog.offers:[];return offers.filter(offer=>offer.approval_required===false&&offer.checkout_available===true&&offer.status==='VERIFIED_AVAILABLE')}
function loadApprovedOfferMappings(){if(!fs.existsSync(APPROVED_OFFER_CATALOG))return[];const catalog=JSON.parse(fs.readFileSync(APPROVED_OFFER_CATALOG,'utf8'));return Array.isArray(catalog.approved)?catalog.approved:[]}
function productAsOffer(product){const sold=Number(product.inventory||0)<1;return{offer_id:product.id,version:'offer-v1',capability_id:`PRODUCT-${product.id}`,silo:product.silo,name:product.name,problem:'Purchase the published product.',input:'No additional input required to purchase.',output:product.description,target_buyer:'Buyer seeking the published product.',offer_type:'product',delivery_method:'physical_delivery',price:Number(product.price)/100,currency:'NZD',pricing_mode:'fixed',pricing_tier:null,eligibility:'Available while inventory remains.',proof_of_delivery:'stripe_payment_plus_durable_transaction_proof',approval_required:false,checkout_available:!sold,checkout_route:'/api/offer-checkout/create',status:sold?'sold':'VERIFIED_AVAILABLE',verification_rules:['canonical_product','explicit_operator_approval','inventory_positive','stripe_checkout','webhook_proof'],private_material_excluded:true}}
function publicCheckoutableProduct(product){const sold=Number(product.inventory||0)<1;if(sold)return null;return{id:product.id,silo:product.silo,name:product.name,description:product.description,price:Number(product.price),currency:product.currency,inventory:Number(product.inventory),status:'published',approval_required:false,checkout_available:true}}
function approvedProductOffer(id){const mapping=loadApprovedOfferMappings().find(item=>item.offer_id===id&&item.product_id);if(!mapping)return null;const product=loadApprovedProducts().find(item=>item.id===mapping.product_id);if(!product)return null;return{...productAsOffer(product),offer_id:mapping.offer_id,product_id:product.id,silo:mapping.silo||product.silo}}
function replayRequest(req,payload){const replay=Readable.from([payload]);replay.method=req.method;replay.url=req.url;replay.headers=req.headers;replay.httpVersion=req.httpVersion;replay.socket=req.socket;return replay}
function serveDreamiezFile(req,res,requestPath){if(!requestPath.startsWith('/dreamiez/'))return false;const relative=requestPath.slice('/dreamiez/'.length)||'dreamiez.html';const candidate=path.normalize(path.join(DREAMIEZ_ROOT,relative));if(candidate!==DREAMIEZ_ROOT&&!candidate.startsWith(DREAMIEZ_ROOT+path.sep))return send(res,403,{error:'Forbidden'}),true;fs.readFile(candidate,(err,data)=>{if(err)return send(res,404,{error:'Dreamiez page not found'});const ext=path.extname(candidate).toLowerCase();res.writeHead(200,{'Content-Type':DREAMIEZ_MIME[ext]||'application/octet-stream','Cache-Control':'no-store'});res.end(data)});return true}
http.createServer=function wrappedCreateServer(...args){const originalHandler=args[0];args[0]=async function dreamledgerRuntimeHandler(req,res){const requestPath=String(req.url||'').split('?')[0];demandRadar.record('route',{route:requestPath,source:'runtime'});
if(req.method==='GET'&&requestPath==='/healthz')return send(res,200,{status:'ok'});
try{if(await accountRecovery.handle(req,res,requestPath))return}catch(err){return send(res,500,{error:err.message||'Account recovery route failed'})}
try{if(await frontDoor.handle(req,res,requestPath))return}catch(err){return send(res,500,{error:err.message||'Front door route failed'})}
if(req.method==='POST'&&requestPath==='/webhook'){const marketplaceResult=await marketplaceWebhook.handle(req,res);if(marketplaceResult.handled)return;const replayed=replayRequest(req,marketplaceResult.raw||'');try{const platformResult=await platformCart.handleWebhook(replayed,res);if(platformResult.handled)return;const omniResult=await omniCommerce.handleWebhook(replayRequest(req,marketplaceResult.raw||''),res);if(omniResult.handled)return;return originalHandler(replayRequest(req,marketplaceResult.raw||''),res)}catch(err){return send(res,400,{error:err.message||'Webhook rejected'})}}
try{if(await platformCart.handle(req,res,requestPath))return}catch(err){return send(res,500,{error:err.message||'Platform cart route failed'})}
try{if(await omniCommerce.handle(req,res,requestPath))return}catch(err){return send(res,500,{error:err.message||'Omni-commerce route failed'})}
if(req.method==='GET'&&requestPath==='/api/products'){try{return send(res,200,{products:loadApprovedProducts().map(publicCheckoutableProduct).filter(Boolean)})}catch{return send(res,500,{error:'Product surface unavailable'})}}
if(req.method==='GET'&&requestPath.startsWith('/api/products/')){const productId=requestPath.slice('/api/products/'.length);const product=loadApprovedProducts().find(item=>item.id===productId);const publicProduct=product?publicCheckoutableProduct(product):null;return publicProduct?send(res,200,publicProduct):send(res,404,{error:'Product not available'})}
if(req.method==='GET'&&requestPath==='/api/offers'){try{return send(res,200,{offers:[...loadVerifiedOffers(),...loadApprovedProducts().map(productAsOffer).filter(o=>o.checkout_available)]})}catch{return send(res,500,{error:'Offer surface unavailable'})}}
if(req.method==='GET'&&requestPath.startsWith('/api/offers/')){const offerId=requestPath.slice('/api/offers/'.length);const productOffer=approvedProductOffer(offerId);if(productOffer)return send(res,200,productOffer);const verified=loadVerifiedOffers().find(item=>item.offer_id===offerId);return verified?send(res,200,verified):send(res,404,{error:'Offer not available'})}
if(req.method==='POST'&&requestPath==='/api/offer-checkout/create'){try{const requestBody=await jsonBody(req);const productOffer=approvedProductOffer(requestBody.offer_id);if(productOffer)return directProductCheckout(res,productOffer.product_id,productOffer.silo);const verified=loadVerifiedOffers().find(item=>item.offer_id===requestBody.offer_id);if(!verified)return send(res,403,{error:'Offer is not approved for checkout'});return originalHandler(replayRequest(req,JSON.stringify(requestBody)),res)}catch(err){return send(res,400,{error:err.message||'Invalid checkout request'})}}
if(req.method==='GET'&&requestPath==='/api/digital-proxy/help')return send(res,405,{error:'Method not allowed'});
if(req.method==='POST'&&requestPath==='/api/digital-proxy/help'){try{const requestBody=await jsonBody(req);demandRadar.record('help_request',{route:requestPath,source:'digital-proxy'});return send(res,200,await digitalProxyAssistant.reply(requestBody.message,{route:requestBody.route||requestPath}))}catch(err){return send(res,400,{error:err.message||'Help request failed'})}}
if(requestPath==='/api/control/demand'||requestPath==='/api/control/demand/record'||requestPath==='/api/control/sentinel'){if(await controlPlane.handle(req,res))return}
if(await dreamiezAccount.handle(req,res))return;
if(req.method==='GET'&&requestPath==='/dreamiez'){res.writeHead(302,{Location:'/dreamiez/dreamiez.html'});return res.end()}
if(req.method==='GET'&&requestPath.startsWith('/dreamiez/'))return serveDreamiezFile(req,res,requestPath);
if(await controlPlane.handle(req,res))return;return originalHandler(req,res)};capturedServer=originalCreateServer.apply(this,args);return capturedServer}
async function directProductCheckout(res,productId,silo){try{return send(res,200,await platformCart.createProductCheckout(productId,silo))}catch(err){const message=err.message||'Checkout creation failed';const status=message.includes('not configured')?503:message.includes('not checkoutable')?403:502;return send(res,status,{error:message})}}
const boot=controlPlane.boot();const sentinelResult=sentinel.run(boot.gauntlet);console.log(JSON.stringify({control_plane_boot:boot,sentinel:sentinelResult},null,2));if(boot.status!=='PASS'||sentinelResult.verdict!=='PASS')throw new Error('Enterprise boot gate failed; refusing to start runtime');require('./server.js');if(!capturedServer)throw new Error('DreamLedger server did not create an HTTP server');if(!capturedServer.listening)capturedServer.listen(PORT,'0.0.0.0',()=>console.log(`DreamLedger commerce runtime listening on 0.0.0.0:${PORT}`));
