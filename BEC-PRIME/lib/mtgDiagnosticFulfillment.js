'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA = path.resolve(process.env.MTG_DIAGNOSTIC_DATA_DIR || path.join(ROOT, 'data', 'mtg-diagnostics'));
const REPORTS = path.join(DATA, 'reports');
const INTAKES = path.join(DATA, 'intakes');
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const STRIPE_PRICE_ID = process.env.MTG_DIAGNOSTIC_STRIPE_PRICE_ID || 'price_1UFFY1EGgEAnUFF9Yq03zIa7';
const PAYMENT_LINK = 'https://buy.stripe.com/eVqeVdc1T01n1DV3gwdwc30';
const PRODUCT_ID = 'COMMANDER-DECK-DIAGNOSTIC-001';
const OFFER_ID = 'OFFER-CMD-DIAG-29-NZD';

function mkdirs(){fs.mkdirSync(INTAKES,{recursive:true});fs.mkdirSync(REPORTS,{recursive:true});}
function safeJson(file,fallback=null){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function writeJson(file,value){mkdirs();fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n','utf8');}
function id(){return 'mtgdiag_'+crypto.randomBytes(12).toString('hex');}
function parseDecklist(text){
  return String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(line=>{
    const m=line.match(/^(\d+)x?\s+(.+?)(?:\s+\[[^\]]+\])?$/); return {qty:m?Math.min(Number(m[1]),20):1,name:(m?m[2]:line).trim()};
  }).filter(x=>x.name.length>1).slice(0,120);
}
function classify(cards){
  const rules={lands:/\b(island|swamp|mountain|forest|plains|command tower|path of ancestry|temple|guildgate|land)\b/i,ramp:/\b(sol ring|arcane signet|signet|talisman|cultivate|kodama|rampant growth|fellwar stone|mana crypt|mana vault)\b/i,draw:/\b(phyrexian arena|rhystic study|mystic remora|sign in blood|harmonize|faithless looting|brainstorm|ponder|preordain|read the bones)\b/i,removal:/\b(swords to plowshares|path to exile|beast within|generous gift|pongify|rapid hybridization|terminate|counterspell|go for the throat|hero's downfall|cyclonic rift|wrath|damnation)\b/i};
  const totals={lands:0,ramp:0,draw:0,removal:0};
  for(const c of cards){const n=c.qty;for(const [k,re] of Object.entries(rules))if(re.test(c.name))totals[k]+=n;}
  return totals;
}
async function scryfall(cards){
  const out=[]; const unique=[...new Map(cards.map(c=>[c.name.toLowerCase(),c])).values()];
  for(let i=0;i<unique.length;i+=75){
    const identifiers=unique.slice(i,i+75).map(c=>({name:c.name}));
    try{const r=await fetch('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'content-type':'application/json','user-agent':'DreamLedger-MTG-Diagnostic/1.0'},body:JSON.stringify({identifiers})});if(!r.ok)continue;const j=await r.json();for(const c of (j.data||[])){const src=unique.find(x=>x.name.toLowerCase()===String(c.name).toLowerCase());out.push({...c,qty:src?src.qty:1});}}catch{}
  }
  return out;
}
function makeReport(intake,cards,scry){
  const totals=classify(cards); const count=cards.reduce((n,c)=>n+c.qty,0); const unique=cards.length;
  const commander=intake.commander||cards[0]?.name||'Not supplied';
  const issues=[];
  if(count<95)issues.push('Decklist appears incomplete: fewer than 95 cards were supplied.');
  if(count>100)issues.push('Decklist contains more than 100 cards; confirm intended Commander-legal configuration.');
  if(totals.lands<30)issues.push('Land count appears light for a typical Commander shell.');
  if(totals.ramp<7)issues.push('Recognised ramp count is light.');
  if(totals.draw<6)issues.push('Recognised card-advantage count is light.');
  if(totals.removal<7)issues.push('Recognised interaction count is light.');
  if(!issues.length)issues.push('No obvious structural red flag was detected by the automated first-pass rules.');
  const cuts=cards.filter(c=>c.qty===1).slice(-5).map(c=>c.name);
  const adds=[]; if(totals.ramp<7)adds.push('Add 2-3 efficient mana/ramp pieces appropriate to the commander colours.');if(totals.draw<6)adds.push('Add 2-3 repeatable or efficient card-advantage effects.');if(totals.removal<7)adds.push('Add 2-3 flexible interaction pieces.');if(!adds.length)adds.push('Prioritise upgrades that directly advance the commander strategy rather than generic power increases.');
  const report={schema:'DREAMLEDGER-MTG-DIAGNOSTIC/v1',status:'FULFILLED',product_id:PRODUCT_ID,offer_id:OFFER_ID,transaction_id:intake.transaction_id||null,commander,strategy:intake.strategy||null,budget:intake.budget||null,deck_count:count,unique_cards:unique,scryfall_matches:scry.length,summary:'Automated first-pass Commander deck diagnostic generated from the buyer-supplied decklist.',metrics:totals,three_biggest_issues:issues.slice(0,3),five_cut_candidates:cuts,five_add_priorities:adds.slice(0,5),play_pattern:'Review the listed structural weaknesses first, then retest the deck against its stated win condition.',method:'Deterministic structural analysis plus Scryfall card identity enrichment. This is not a rules-engine simulation.',generated_at:new Date().toISOString()};
  report.report_hash=crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex');return report;
}
async function createIntake(input){
  const cards=parseDecklist(input.decklist);if(cards.length<10)throw new Error('Please supply at least 10 decklist lines.');const intakeId=id();const intake={intake_id:intakeId,product_id:PRODUCT_ID,offer_id:OFFER_ID,commander:String(input.commander||''),strategy:String(input.strategy||''),budget:String(input.budget||''),decklist:String(input.decklist),cards,created_at:new Date().toISOString(),status:'awaiting_payment'};writeJson(path.join(INTAKES,intakeId+'.json'),intake);return intake;}
function form(params){const out=new URLSearchParams();for(const[k,v]of Object.entries(params))out.set(k,String(v));return out;}
async function stripeSession(intake){if(!STRIPE_SECRET_KEY)throw new Error('STRIPE_SECRET_KEY is not configured');const sessionParams={'mode':'payment','line_items[0][price]':STRIPE_PRICE_ID,'line_items[0][quantity]':'1','success_url':PUBLIC_BASE+'/mtg/diagnostic-success.html?session_id={CHECKOUT_SESSION_ID}','cancel_url':PUBLIC_BASE+'/mtg?diagnostic_cancelled=1','metadata[product_id]':PRODUCT_ID,'metadata[offer_id]':OFFER_ID,'metadata[silo]':'mtg','metadata[intake_id]':intake.intake_id,'metadata[commerce_version]':'mtg-diagnostic-auto-v1','customer_creation':'always'};const r=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY,'content-type':'application/x-www-form-urlencoded','Idempotency-Key':'dreamledger-mtg-diagnostic-'+intake.intake_id},body:form(sessionParams)});const t=await r.text();let j;try{j=JSON.parse(t)}catch{j={}}if(!r.ok)throw new Error(j?.error?.message||'Stripe checkout creation failed');return j;}
async function assertEconomicLedgerReady(){
  if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)throw new Error('Economic ledger unavailable; checkout held until settlement recording is reachable');
  let response;
  try {
    response=await fetch(SUPABASE_URL+'/rest/v1/rpc/resolve_economic_offer_id',{
      method:'POST',
      headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({p_offer_key:OFFER_ID,p_sku_id:'CMD-DIAG-29',p_amount_nzd:29})
    });
  } catch {
    throw new Error('Economic ledger unavailable; checkout held until settlement recording is reachable');
  }
  if(!response.ok)throw new Error('Economic ledger unavailable; checkout held until settlement recording is reachable');
  let offerId=null;try{offerId=await response.json();}catch{}
  if(!offerId)throw new Error('Canonical economic offer unavailable; checkout held');
}
async function createCheckout(input){
  if(!STRIPE_SECRET_KEY)throw new Error('STRIPE_SECRET_KEY is not configured');
  await assertEconomicLedgerReady();
  const intake=await createIntake(input);
  try {
    const session=await stripeSession(intake);
    intake.session_id=session.id;
    intake.status='checkout_created';
    writeJson(path.join(INTAKES,intake.intake_id+'.json'),intake);
    return{ok:true,intake_id:intake.intake_id,session_id:session.id,checkout_url:session.url};
  } catch(e) {
    intake.status='checkout_failed';
    intake.error=e.message;
    writeJson(path.join(INTAKES,intake.intake_id+'.json'),intake);
    throw e;
  }
}
async function createPaymentLinkCheckout(input){return createCheckout(input);}
async function verifySettledPayment(session){
  if(!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
  if(session?.livemode!==true) throw new Error('LIVE_PAYMENT_REQUIRED');
  if(String(session?.payment_status||'')!=='paid') throw new Error('PAYMENT_NOT_SETTLED');
  const paymentIntentId=typeof session?.payment_intent==='string'?session.payment_intent:(session?.payment_intent?.id||'');
  if(!paymentIntentId) throw new Error('PAYMENT_INTENT_REQUIRED');
  const response=await fetch('https://api.stripe.com/v1/payment_intents/'+encodeURIComponent(paymentIntentId),{headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY}});
  const text=await response.text(); let paymentIntent; try{paymentIntent=JSON.parse(text)}catch{paymentIntent=null;}
  if(!response.ok||!paymentIntent) throw new Error('PAYMENT_INTENT_LOOKUP_FAILED');
  if(paymentIntent.livemode!==true||paymentIntent.status!=='succeeded') throw new Error('PAYMENT_INTENT_NOT_SUCCEEDED');
  if(Number(paymentIntent.amount)!==Math.round(Number(session.amount_total||0))) throw new Error('PAYMENT_AMOUNT_MISMATCH');
  if(String(paymentIntent.currency||'').toLowerCase()!==String(session.currency||'').toLowerCase()) throw new Error('PAYMENT_CURRENCY_MISMATCH');
  return {payment_intent_id:paymentIntent.id,status:paymentIntent.status,amount:paymentIntent.amount,currency:paymentIntent.currency};
}
async function fulfillPaidSession(session){
  const settlement=await verifySettledPayment(session);
  const intakeId=session.metadata?.intake_id || (String(session.client_reference_id||'').startsWith('mtgdiag_') ? session.client_reference_id : null);if(!intakeId)return null;const intake=safeJson(path.join(INTAKES,intakeId+'.json'));if(!intake)throw new Error('Unknown diagnostic intake: '+intakeId);const file=path.join(REPORTS,session.id+'.json');if(fs.existsSync(file))return safeJson(file);intake.transaction_id=session.id;intake.payment_intent_id=settlement.payment_intent_id;intake.settlement_status='PAYMENT_INTENT_SUCCEEDED';intake.status='paid';writeJson(path.join(INTAKES,intakeId+'.json'),intake);const enriched=await scryfall(intake.cards);const report=makeReport(intake,intake.cards,enriched);writeJson(file,report);intake.status='fulfilled';intake.report_path=file;intake.report_hash=report.report_hash;writeJson(path.join(INTAKES,intakeId+'.json'),intake);return report;}
// This adapter consumes the EXISTING Stripe Payment Link. It never fetches user
// URLs, sends mail, charges a card, or marks an order delivered.
const DIRECT_PAYMENT_LINK_ID = 'plink_1URUN1EGgEAnUFF9qPz94dqS';
const LINK_INTAKE_AMOUNT_MINOR = 2900;
function validatePublicDecklistUrl(value) {
  if (typeof value !== 'string' || value.length > 255) throw new Error('DECKLIST_URL_INVALID');
  let u;
  try { u = new URL(value); } catch { throw new Error('DECKLIST_URL_INVALID'); }
  const h = u.hostname.toLowerCase();
  const validHost = h === 'moxfield.com' || h === 'www.moxfield.com' ||
    h === 'archidekt.com' || h === 'www.archidekt.com';
  const validPath = (h.includes('moxfield') && /^\\/decks\\/[A-Za-z0-9_-]+\\/?$/.test(u.pathname)) ||
    (h.includes('archidekt') && /^\\/decks\\/[A-Za-z0-9_-]+(?:\\/[A-Za-z0-9_-]+)?\\/?$/.test(u.pathname));
  if (u.protocol !== 'https:' || !validHost || !validPath ||
      u.port || u.username || u.password || u.search || u.hash) {
    throw new Error('DECKLIST_URL_UNSUPPORTED');
  }
  return u.toString();
}
function parsePaymentLinkIntake(session) {
  const linkId = typeof session?.payment_link === 'string' ?
    session.payment_link : session?.payment_link?.id;
  if (linkId !== DIRECT_PAYMENT_LINK_ID) throw new Error('UNKNOWN_PAYMENT_LINK');
  if (session?.livemode !== true || session?.payment_status !== 'paid' ||
      session?.status !== 'complete') throw new Error('PAID_LIVE_SESSION_REQUIRED');
  if (session.currency !== 'nzd' || session.amount_total !== LINK_INTAKE_AMOUNT_MINOR)
    throw new Error('PRICE_CURRENCY_MISMATCH');
  if (session.metadata?.product_id !== PRODUCT_ID ||
      session.metadata?.silo !== 'mtg') throw new Error('SILO_PRODUCT_MISMATCH');
  if (!/^cs_live_[A-Za-z0-9]+$/.test(String(session.id || '')))
    throw new Error('SESSION_ID_INVALID');
  const deckField = (session.custom_fields || []).filter(x => x.key === 'decklisturl' && x.type === 'text');
  if (deckField.length !== 1 || !deckField[0].text?.value)
    throw new Error('DECKLIST_URL_MISSING');
  const email = String(session.customer_details?.email || session.customer_email || '').trim();
  if (email.length > 254 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))
    throw new Error('BUYER_EMAIL_MISSING');
  return {
    session_id: session.id,
    payment_link_id: linkId,
    amount_minor: LINK_INTAKE_AMOUNT_MINOR,
    currency: 'nzd',
    decklist_url: validatePublicDecklistUrl(deckField[0].text.value),
    customer_email: email,
  };
}
async function capturePaidLinkOrder(session) {
  // Explicit operator-managed durable location required: never silently use
  // ephemeral repository-relative storage for new live Payment Link orders.
  if (!process.env.MTG_DIAGNOSTIC_DATA_DIR ||
      !path.isAbsolute(process.env.MTG_DIAGNOSTIC_DATA_DIR))
    throw new Error('DURABLE_ORDER_STORAGE_UNCONFIGURED');
  const intake = parsePaymentLinkIntake(session);
  const settlement = await verifySettledPayment(session);
  const record = {
    schema: 'dreamledger/mtg-diagnostic-paid-link-handoff/v1',
    status: 'PAID_AWAITING_MANUAL_DELIVERY',
    is_delivered: false,
    counts_as_verified_external_revenue: false,
    product_id: PRODUCT_ID,
    offer_id: OFFER_ID,
    silo: 'mtg',
    ...intake,
    payment_intent_id: settlement.payment_intent_id,
    payment_status: settlement.status,
    recorded_at_utc: new Date().toISOString(),
    delivery_evidence: null,
  };
  fs.mkdirSync(INTAKES, { recursive: true, mode: 0o700 });
  const dest = path.join(INTAKES, intake.session_id + '.json');
  try {
    fs.writeFileSync(dest, JSON.stringify(record, null, 2) + '\\n', { flag: 'wx', mode: 0o600 });
    return { ...record, already_recorded: false };
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    const previous = safeJson(dest);
    if (!previous || previous.payment_intent_id !== record.payment_intent_id ||
        previous.decklist_url !== record.decklist_url ||
        previous.customer_email !== record.customer_email ||
        previous.payment_link_id !== DIRECT_PAYMENT_LINK_ID)
      throw new Error('PAID_SESSION_IDEMPOTENCY_CONFLICT');
    return { ...previous, already_recorded: true };
  }
}
function getReport(sessionId){return safeJson(path.join(REPORTS,String(sessionId)+'.json'));}
module.exports={createCheckout,createPaymentLinkCheckout,fulfillPaidSession,getReport,parseDecklist,classify,parsePaymentLinkIntake,capturePaidLinkOrder};
