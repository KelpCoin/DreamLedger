'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const diagnostic=require('../lib/mtgDiagnosticFulfillment');
const ROOT=path.join(__dirname,'..');
const DATA=path.resolve(process.env.MTG_DIAGNOSTIC_DATA_DIR||path.join(ROOT,'data','mtg-diagnostics'));
const STRIPE_SECRET_KEY=process.env.STRIPE_SECRET_KEY||'';
const WEBHOOK_SECRET=process.env.STRIPE_WEBHOOK_SECRET||'';
function send(res,status,body){if(res.writableEnded)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
async function body(req){let s='';for await(const c of req){s+=c;if(s.length>100000)throw new Error('Request too large');}return JSON.parse(s||'{}');}
function verify(raw,header){if(!WEBHOOK_SECRET)throw new Error('STRIPE_WEBHOOK_SECRET is not configured');const parts=String(header||'').split(',');const t=(parts.find(x=>x.startsWith('t='))||'').slice(2);const sigs=parts.filter(x=>x.startsWith('v1=')).map(x=>x.slice(3));if(!t||!sigs.length)throw new Error('Invalid Stripe signature');if(Math.abs(Date.now()/1000-Number(t))>300)throw new Error('Expired Stripe signature');const expected=crypto.createHmac('sha256',WEBHOOK_SECRET).update(t+'.'+raw,'utf8').digest('hex');if(!sigs.some(s=>s.length===expected.length&&crypto.timingSafeEqual(Buffer.from(s),Buffer.from(expected))))throw new Error('Invalid Stripe signature');}
async function handleWebhook(req,res){let raw='';for await(const c of req){raw+=c;if(raw.length>5000000)throw new Error('Request too large');}verify(raw,req.headers['stripe-signature']);const event=JSON.parse(raw);if(event.type!=='checkout.session.completed')return send(res,200,{received:true,handled:false});const session=event.data.object;if(session.payment_status!=='paid')return send(res,200,{received:true,handled:false,payment_status:session.payment_status});if(session.metadata?.product_id!=='COMMANDER-DECK-DIAGNOSTIC-001')return {handled:false,raw};const report=await diagnostic.fulfillPaidSession(session);return send(res,200,{received:true,handled:true,fulfilled:!!report,transaction_id:session.id,report_hash:report?.report_hash||null});}
async function handle(req,res,url){if(req.method==='POST'&&url==='/api/mtg/diagnostic/intake'){const input=await body(req);const result=await diagnostic.createCheckout(input);return send(res,200,result);}
if(req.method==='GET'&&url==='/api/mtg/diagnostic/report'){const u=new URL(req.url,'https://dreamledger.org');const sessionId=u.searchParams.get('session_id');if(!sessionId)return send(res,400,{error:'session_id is required'});const report=diagnostic.getReport(sessionId);if(!report)return send(res,404,{error:'Report not ready'});if(report.status!=='FULFILLED')return send(res,409,{error:'Report not fulfilled'});return send(res,200,report);}
if(req.method==='POST'&&url==='/api/mtg/diagnostic/webhook'){try{return await handleWebhook(req,res);}catch(e){return send(res,400,{error:e.message});}}
return false;}
module.exports={handle};
