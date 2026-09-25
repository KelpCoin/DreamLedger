'use strict';

const crypto = require('crypto');
const PRODUCT_ID = 'COMMANDER-DECK-DIAGNOSTIC-001';
const OFFER_ID = 'OFFER-CMD-DIAG-29-NZD';
const PAYMENT_LINK_ID = 'plink_1UJ3NlEGgEAnUFF9wAINPrwZ';
const PRICE_MINOR = 2900;
const CURRENCY = 'nzd';
const INTERVAL_MS = Number(process.env.COMMERCIAL_CELL_POLL_MS || 300000);
let state = { status:'IDLE', checked_at:null, candidates:0, last_error:null, sessions:[] };

function hash(value){ return crypto.createHash('sha256').update(String(value),'utf8').digest('hex'); }
async function stripeGet(path){
  const key=process.env.STRIPE_SECRET_KEY||'';
  if(!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  const r=await fetch('https://api.stripe.com/v1/'+path,{headers:{Authorization:'Bearer '+key}});
  const t=await r.text(); let j; try{j=JSON.parse(t)}catch{j={raw:t}};
  if(!r.ok) throw new Error(j?.error?.message||'Stripe API '+r.status);
  return j;
}
async function listPaidSessions(){
  const q=new URLSearchParams({payment_link:PAYMENT_LINK_ID,limit:'100'});
  const j=await stripeGet('checkout/sessions?'+q.toString());
  return (Array.isArray(j.data)?j.data:[]).filter(s=>s.livemode===true&&s.payment_status==='paid'&&Number(s.amount_total)===PRICE_MINOR&&String(s.currency).toLowerCase()===CURRENCY);
}
async function chargeSettlement(session){
  if(!session.payment_intent) return {status:'UNKNOWN',reason:'missing_payment_intent'};
  const pi=await stripeGet('payment_intents/'+encodeURIComponent(session.payment_intent)+'?expand[]=latest_charge.balance_transaction');
  const charge=pi.latest_charge;
  const bt=charge?.balance_transaction;
  if(!bt) return {status:'UNKNOWN',reason:'missing_balance_transaction'};
  const availableOn=Number(bt.available_on||0);
  const now=Math.floor(Date.now()/1000);
  const available=String(bt.status||'').toLowerCase()==='available' || (availableOn>0 && availableOn<=now);
  return {status:available?'AVAILABLE':'PENDING',available_on:availableOn?new Date(availableOn*1000).toISOString():null,balance_transaction_id:bt.id||null,amount:bt.amount||null,fee:bt.fee||null,net:bt.net||null,currency:bt.currency||null};
}
async function scan(){
  state={...state,status:'RUNNING',checked_at:new Date().toISOString(),last_error:null};
  try{
    const sessions=await listPaidSessions();
    const rows=[];
    for(const session of sessions.slice(0,25)){
      rows.push({
        session_id:session.id,
        product_id:PRODUCT_ID,
        offer_id:OFFER_ID,
        livemode:session.livemode===true,
        payment_status:session.payment_status,
        amount_minor:Number(session.amount_total),
        currency:String(session.currency).toLowerCase(),
        settlement:await chargeSettlement(session)
      });
    }
    state={...state,status:'PASS',checked_at:new Date().toISOString(),candidates:rows.length,sessions:rows};
    return state;
  }catch(error){
    state={...state,status:'ERROR',checked_at:new Date().toISOString(),last_error:error.message,sessions:[]};
    return state;
  }
}
function start(){
  if(global.__dreamledgerCommercialCellRunner) return;
  global.__dreamledgerCommercialCellRunner=true;
  scan();
  setInterval(scan,INTERVAL_MS).unref?.();
}
function snapshot(){
  return {schema:'DREAMLEDGER/COMMERCIAL-CELL/v1',cell_id:'CELL-CMD-DIAG-29',product_id:PRODUCT_ID,offer_id:OFFER_ID,truth_authority:'Stripe provider evidence + fulfillment evidence + DreamLedger ledger',truth_floor:['external_buyer','live_paid','funds_available','correct_attribution','fulfillment_evidence'],controller_never_emits_VERIFIED:true,...state};
}
module.exports={start,scan,snapshot,hash};
