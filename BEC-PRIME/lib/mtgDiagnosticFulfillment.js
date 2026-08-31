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
const STRIPE_PRICE_ID = process.env.MTG_DIAGNOSTIC_STRIPE_PRICE_ID || 'price_1UAJyAJt4ieIQDFzj8DQBNNT';
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
async function createCheckout(input){const intake=await createIntake(input);try{const session=await stripeSession(intake);intake.session_id=session.id;intake.status='checkout_created';writeJson(path.join(INTAKES,intake.intake_id+'.json'),intake);return{ok:true,intake_id:intake.intake_id,session_id:session.id,checkout_url:session.url};}catch(e){intake.status='checkout_failed';intake.error=e.message;writeJson(path.join(INTAKES,intake.intake_id+'.json'),intake);throw e;}}
async function fulfillPaidSession(session){const intakeId=session.metadata?.intake_id;if(!intakeId)return null;const intake=safeJson(path.join(INTAKES,intakeId+'.json'));if(!intake)throw new Error('Unknown diagnostic intake: '+intakeId);const file=path.join(REPORTS,session.id+'.json');if(fs.existsSync(file))return safeJson(file);intake.transaction_id=session.id;intake.status='paid';writeJson(path.join(INTAKES,intakeId+'.json'),intake);const enriched=await scryfall(intake.cards);const report=makeReport(intake,intake.cards,enriched);writeJson(file,report);intake.status='fulfilled';intake.report_path=file;intake.report_hash=report.report_hash;writeJson(path.join(INTAKES,intakeId+'.json'),intake);return report;}
function getReport(sessionId){return safeJson(path.join(REPORTS,String(sessionId)+'.json'));}
module.exports={createCheckout,fulfillPaidSession,getReport,parseDecklist,classify};
