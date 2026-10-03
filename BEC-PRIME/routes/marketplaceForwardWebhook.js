'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const stripeProof=require('../lib/stripeWebhookProof');
const revenueLedger=require('../lib/revenueLedger');
const marketplacePolicy=require('../lib/marketplacePolicy');

const ROOT=path.join(__dirname,'..');
const DATA_ROOT=process.env.DREAMIEZ_DATA_DIR || ((fs.existsSync('/var/data')&&fs.statSync('/var/data').isDirectory())?'/var/data/dreamiez':path.join(ROOT,'data','dreamiez'));
const LISTINGS=path.join(DATA_ROOT,'marketplace-listings.json');
const ORDERS=path.join(DATA_ROOT,'marketplace-orders.json');
const PROOFS=path.resolve(process.env.PROOF_DATA_DIR||path.join(ROOT,'data','proofs'));
const SECRET=String(process.env.STRIPE_WEBHOOK_SECRET||'');

function read(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp-'+process.pid+'-'+Date.now();fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n');fs.renameSync(tmp,file);}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function handle(req,res){
 if(req.method!=='POST'||req.url.split('?')[0]!=='/api/marketplace/v2/webhook')return false;
 let raw='';for await(const chunk of req)raw+=chunk;
 try{
  if(!SECRET)throw Object.assign(new Error('STRIPE_WEBHOOK_SECRET is not configured'),{statusCode:503});
  stripeProof.verifyStripeSignature(raw,req.headers['stripe-signature']||'',SECRET);
  const event=JSON.parse(raw);
  if(event.livemode!==true)return json(res,200,{received:true,ignored:true,reason:'not_livemode'});
  if(event.type!=='checkout.session.completed')return json(res,200,{received:true,ignored:true,event_type:event.type});
  const session=event.data?.object||{};
  if(String(session.metadata?.dreamledger_sku||'')!=='MARKETPLACE-LISTING')return json(res,200,{received:true,ignored:true,reason:'not_marketplace'});
  if(session.payment_status!=='paid')return json(res,200,{received:true,fulfilled:false,reason:'payment_not_paid'});
  const listingId=String(session.metadata?.marketplace_listing_id||''),orderId=String(session.metadata?.marketplace_order_id||'');
  if(!listingId||!orderId)throw Object.assign(new Error('marketplace metadata incomplete'),{statusCode:400});
  const listings=read(LISTINGS,[]),listing=listings.find(x=>x.id===listingId);if(!listing)throw Object.assign(new Error('listing not found'),{statusCode:404});
  const orders=read(ORDERS,[]),order=orders.find(x=>x.id===orderId);if(!order)throw Object.assign(new Error('order not found'),{statusCode:404});
  if(order.payment_status==='PAID')return json(res,200,{received:true,idempotent:true,order_id:order.id});
  if(order.stripe_checkout_session&&order.stripe_checkout_session!==session.id)throw Object.assign(new Error('checkout session mismatch'),{statusCode:409});
  const amountMinor=Number(session.amount_total||0);const currency=String(session.currency||'nzd').toUpperCase();
  const fee=marketplacePolicy.calculateMarketplaceFee(listing.seller_id,'MARKETPLACE',amountMinor/100);
  const payment=revenueLedger.recordPayment({eventId:event.id,transactionId:session.id,amountMinor,currency,productId:listing.id,offerId:null,silo:'MARKETPLACE'});
  const fulfillment=revenueLedger.createFulfillment({transactionId:session.id,productId:listing.id,offerId:null,silo:'MARKETPLACE',amountMinor,currency,customerEmail:session.customer_details?.email||session.customer_email});
  order.stripe_checkout_session=session.id;order.stripe_payment_intent=session.payment_intent||null;order.platform_fee_nzd=fee.fee_amount;order.net_to_seller_nzd=fee.net_to_seller;order.ledger_payment_journal_id=payment.journal_id||null;order.fulfillment_id=fulfillment.fulfillment?.fulfillment_id||null;order.status='PAID';order.payment_status='PAID';order.fulfilment_status='READY';order.paid_at=new Date().toISOString();order.external_buyer=true;order.payment_evidence={event_id:event.id,checkout_session_id:session.id,payment_intent:session.payment_intent||null,livemode:true,amount_nzd:Number(session.amount_total||0)/100,currency:String(session.currency||'').toUpperCase()};
  listing.reserved=Math.max(0,Number(listing.reserved||0)-1);listing.sold=Number(listing.sold||0)+1;if(Number(listing.sold||0)>=Number(listing.quantity||1))listing.status='SOLD';
  write(ORDERS,orders);write(LISTINGS,listings);
  fs.mkdirSync(PROOFS,{recursive:true});
  const proof={type:'dreamledger-marketplace-forward-payment-proof',status:'PAYMENT_OBSERVED',event_id:event.id,order_id:order.id,listing_id:listing.id,amount_nzd:Number(session.amount_total||0)/100,currency:String(session.currency||'').toUpperCase(),payment_intent:session.payment_intent||null,checkout_session_id:session.id,independent_buyer:Boolean(session.customer_details?.email||session.customer_email),payment_status:'paid',fulfilment_status:order.fulfilment_status,ledger_payment_recorded:Boolean(payment&&!payment.duplicate),fulfillment_id:fulfillment.fulfillment?.fulfillment_id||null,platform_fee_nzd:fee.fee_amount,verification_status:'UNVERIFIED_UNTIL_FULFILLMENT',recorded_at:new Date().toISOString()};
  const proofFile=path.join(PROOFS,'marketplace-'+order.id+'.json');if(!fs.existsSync(proofFile))write(proofFile,proof);
  return json(res,200,{received:true,order_id:order.id,listing_id:listing.id,payment_observed:true,commercial_truth:'SETTLED_PAYMENT_OBSERVED_NOT_YET_VERIFIED'});
 }catch(e){return json(res,e.statusCode||400,{received:false,error:e.message||'marketplace webhook failed'});}
}
module.exports={handle};
