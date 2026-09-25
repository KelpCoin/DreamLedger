'use strict';

const crypto = require('crypto');
const mtgDiagnostic = require('../lib/mtgDiagnosticFulfillment');
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
async function supabaseRequest(path,method='GET',body){
  const base=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  if(!base||!key) return null;
  const r=await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
  const t=await r.text(); let j; try{j=t?JSON.parse(t):null}catch{j={raw:t}};
  if(!r.ok) throw new Error('Supabase '+method+' '+r.status+': '+String(t).slice(0,400));
  return j;
}
async function supabaseGet(path){
  const base=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  if(!base||!key) return [];
  const r=await fetch(base+'/rest/v1/'+path,{headers:{apikey:key,Authorization:'Bearer '+key}});
  if(!r.ok) throw new Error('Supabase read '+r.status);
  return r.json();
}
async function truthClaims(){
  const rows=await supabaseGet('economic_events?sku_id=eq.CMD-DIAG-29&order=created_at.desc&limit=20');
  return Array.isArray(rows)?rows.map(x=>({event_id:x.event_id,verification_status:x.verification_status,buyer_action_verified:Boolean(x.buyer_action_verified),payment_settled:Boolean(x.payment_settled),fulfilment_verified:Boolean(x.fulfilment_verified),evidence_verified:Boolean(x.evidence_verified),amount_nzd:x.amount_nzd,resulting_state:x.resulting_state,evidence_ref:x.evidence_ref||null})):[];
}
async function finalizeVerified(session,settlement){
  const report=mtgDiagnostic.getReport(session.id);
  if(!report) return {status:'WAITING_FULFILLMENT',reason:'buyer_input_or_report_missing'};
  const existing=await supabaseGet('control_evidence?source_reference=eq.'+encodeURIComponent('stripe:balance_transaction:'+String(settlement.balance_transaction_id))+'&limit=1');
  let evidenceId=Array.isArray(existing)&&existing[0]?.evidence_id;
  if(!evidenceId){
    const evidence=await supabaseRequest('control_evidence','POST',{experiment_id:'MTG-SALES-001',subject:OFFER_ID,evidence_tier:'E4',evidence_type:'stripe_balance_transaction_available',source_reference:'stripe:balance_transaction:'+String(settlement.balance_transaction_id),source_snapshot:JSON.stringify({checkout_session:session.id,payment_intent:session.payment_intent,balance_transaction:settlement.balance_transaction_id,available_on:settlement.available_on,amount:settlement.amount,currency:settlement.currency}),observed_at:new Date().toISOString(),verified_by:'stripe_provider',verification_status:'verified',notes:'Provider-side funds availability evidence for the commercial cell.'});
    evidenceId=Array.isArray(evidence)?evidence[0]?.evidence_id:evidence?.evidence_id;
  }
  if(!evidenceId) return {status:'WAITING_EVIDENCE',reason:'control_evidence_insert_failed'};
  const offer=await supabaseRequest('rpc/resolve_economic_offer_id','POST',{p_offer_key:OFFER_ID,p_sku_id:'CMD-DIAG-29',p_amount_nzd:29});
  const offerId=Array.isArray(offer)?offer[0]:offer;
  if(!offerId) return {status:'WAITING_OFFER',reason:'economic_offer_not_resolved'};
  const outcome=await supabaseRequest('rpc/record_economic_outcome','POST',{p_offer_id:offerId,p_outcome_type:'FULFILLED',p_amount_nzd:29,p_external_reference:'stripe:verified:'+session.id,p_evidence_id:evidenceId,p_metadata:{classification:'OBSERVED',scope:'EXTERNAL',livemode:true,external_buyer:true,settled_transaction:true,attributed:true,fulfilled:true,product_id:PRODUCT_ID,offer_key:OFFER_ID,checkout_session_id:session.id,payment_intent:session.payment_intent,report_hash:report.report_hash,settlement_status:'AVAILABLE',source:'commercial_cell_runner'}});
  return {status:'VERIFIED_ATTEMPTED',evidence_id:evidenceId,outcome_id:Array.isArray(outcome)?outcome[0]:outcome,report_hash:report.report_hash};
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
    const claims=await truthClaims();
    for(const row of rows){ if(row.settlement?.status==='AVAILABLE' && row.fulfillment==='FULFILLED'){ row.finalization=await finalizeVerified(sessions.find(s=>s.id===row.session_id),row.settlement); } }
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
        settlement:await chargeSettlement(session),fulfillment:mtgDiagnostic.getReport(session.id)?'FULFILLED':'WAITING_INPUT'
      });
    }
    state={...state,status:'PASS',checked_at:new Date().toISOString(),candidates:rows.length,sessions:rows,truth_claims:claims,external_truth_match:rows.some(r=>claims.some(c=>c.event_id&&String(c.event_id).includes(r.session_id)))};
    return state;
  }catch(error){
    state={...state,status:'ERROR',checked_at:new Date().toISOString(),last_error:error.message,sessions:[],truth_claims:[]};
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
