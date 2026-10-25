'use strict';
/**
 * BECK CASH-001. Private, read-only commercial closure report.
 * Source catalogues describe offers, not external payment, settlement, or delivery.
 * Never touch Stripe, publish, send messages, enqueue GPU work, or approve offers.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const ID = /^[a-z0-9][a-z0-9_-]{0,90}$/i;
const PRODUCT_ID = /^[A-Z0-9][A-Z0-9-]{0,110}$/;
const STATES = new Set(['HOLD_PRODUCT', 'MISSING_PRODUCT', 'LINK_CONFLICT', 'VERIFY_DELIVERY', 'NO_APPROVED_OFFER', 'UNREGISTERED_WATCH']);
function sha(x) { return crypto.createHash('sha256').update(x).digest('hex'); }
function esc(x) { return String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function read(root, rel) {
  const full = path.resolve(root, rel);
  if (!(full === root || full.startsWith(root + path.sep))) throw Error('OUTSIDE_REPO');
  const content = fs.readFileSync(full, 'utf8');
  return { value: JSON.parse(content), sha256: sha(content) };
}
function statusOf(offer, product, liveOffer) {
  if (!product) return 'MISSING_PRODUCT';
  if (product.status === 'held' || product.status === 'review_required' ||
      product.checkout?.mode === 'disabled' || product.commercial_truth?.sellable !== true) return 'HOLD_PRODUCT';
  const checkout = offer.payment_link_url;
  if (typeof checkout !== 'string' || !checkout.startsWith('https://buy.stripe.com/') ||
      offer.payment_link_status !== 'ACTIVE_LIVEMODE' || offer.approved_by !== 'operator') return 'LINK_CONFLICT';
  if (product.commercial_truth?.payment_link && product.commercial_truth.payment_link !== checkout) return 'LINK_CONFLICT';
  if (liveOffer && liveOffer.checkout !== checkout) return 'LINK_CONFLICT';
  // A file saying "approved" is not evidence that a checkout works or delivery is possible.
  return 'VERIFY_DELIVERY';
}
function actionFor(state, name) {
  switch (state) {
    case 'HOLD_PRODUCT': return 'Reconcile product hold and recorded checkout. Do not accept payment until delivery is approved and verified.';
    case 'LINK_CONFLICT': return 'Compare original Stripe checkout and catalogue sources; require explicit owner approval before changing public links.';
    case 'MISSING_PRODUCT': return 'Locate actual product artifact and fulfilment contract; do not invent inventory.';
    case 'VERIFY_DELIVERY': return 'Verify the real payment-to-delivery route and inventory before offering this item publicly.';
    case 'UNREGISTERED_WATCH': return 'Confirm whether this existing project should join the canonical silo registry. Preserve its assets.';
    default: return 'Discover a real existing deliverable and approved inbound offer. Do not publish speculative stock.';
  }
}
/**
 * Consumer integrity audit. The registry is a seed set, not a ceiling on silos.
 * Canonical acquisition uses ONE QR shared across the whole marketplace.
 * This reads source files only; never grants a product saleable status.
 */
function auditConsumerCatalog({catalog,registry,approved,routeExists=()=>false,qrExists=false,doorwayExists=false}) {
  if(!Array.isArray(catalog?.products)||!Array.isArray(registry?.silos)||!Array.isArray(approved?.approved))
    throw Error('INVALID_CONSUMER_INPUT');
  const approvedIds=new Set(approved.approved.map(o=>String(o.product_id||'')));
  const seen=new Set();
  const products=catalog.products.map(p=>{
    const id=String(p.id||'');
    if(!id||seen.has(id))throw Error('DUPLICATE_OR_MISSING_PRODUCT_ID');
    seen.add(id);
    const declared=p.checkout_available===true;
    const validLink=typeof p.checkout_url==='string' && /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+$/.test(p.checkout_url);
    const held=p.status==='held'||p.status==='gated'||p.checkout_available===false;
    const delivery=String(p.delivery_test_status||'UNKNOWN');
    const approvedRecord=approvedIds.has(id);
    let state='HELD_NOT_OFFERED';
    if(!held&&declared&&!validLink)state='CLAIMED_CHECKOUT_WITHOUT_VALID_LINK';
    else if(!held&&declared)state='UNVERIFIED_END_TO_END_DELIVERY';
    else if(!held)state='NOT_OFFERED';
    return {product_id:id,silo:String(p.category||'UNKNOWN'),declared_checkout:declared,
      has_stripe_link:validLink,operator_approved_record:approvedRecord,
      fulfillment_test_source_state:delivery,
      verdict:state,independently_sellable:false,
      checks_required:['live_url_reachable','real_inventory_or_owned_asset','owner_approval','buyer_input_contract',
        'paid_webhook_or_payment_verification','real_delivery_and_retrieval','refund_and_dispute_process']};
  });
  const routes=registry.silos.map(x=>{
    const path=String(x.route||'');
    const safe=/^\/[a-zA-Z0-9_\/.-]+$/.test(path)&&!path.includes('..');
    return {silo_id:x.id,declared_route:path,
      matching_static_file:safe?Boolean(routeExists(path)):false,
      live_http_status:'UNKNOWN'};
  });
  return {schema:'BECK/CONSUMER-READINESS-AUDIT/v1',
    scope:'ALL_DECLARED_PRODUCTS_AND_SEED_SILO_ROUTES',
    silo_capacity_limit:null,
    source_registered_seed_count:routes.length,
    checked_product_count:products.length,
    declared_checkout_count:products.filter(x=>x.declared_checkout).length,
    independently_verified_sellable_count:0,
    independently_verified_sellable_truth:'UNKNOWN_NOT_TESTED',
    source_route_gaps:routes.filter(x=>!x.matching_static_file).length,
    canonical_qr:{policy:'ONE_PRINT_ACQUISITION_CODE_NOT_PER_PRODUCT',
      source_asset_present:Boolean(qrExists),source_doorway_present:Boolean(doorwayExists),
      target_runtime_reachable:'UNKNOWN'},
    no_purchase_actions_performed:true,
    notes:['A source flag is not a delivery receipt.','Static route absence is not proof a dynamic route is unavailable.',
      'Approval and delivery must be checked against live independent evidence before public saleability claims.'],
    routes,products};
}

function assemble({registry, approved, live, products={}, watch=[], now='1970-01-01T00:00:00.000Z', sourceHashes={}}) {
  if (!Array.isArray(registry?.silos)) throw Error('INVALID_SILO_REGISTRY');
  if (!Array.isArray(approved?.approved)) throw Error('INVALID_APPROVED_OFFERS');
  if (!Array.isArray(live?.offers)) throw Error('INVALID_LIVE_CATALOGUE');
  const entries = new Map();
  function add(id, label, route, registered) {
    if (!ID.test(id)) throw Error('INVALID_SILO_ID');
    if (['amplissa','mplusa','adult'].includes(id.toLowerCase())) return;
    if (!entries.has(id)) entries.set(id,{silo_id:id,label,route:registered?route:null,registered:!!registered,offer_count:0,offers:[],state:registered?'NO_APPROVED_OFFER':'UNREGISTERED_WATCH',next_action:'',front:['dreamledger','digital-products','mtg'].includes(id)?'A':['b2b','procurement','agent-bridge'].includes(id)?'B':'C'});
    else if (registered) Object.assign(entries.get(id),{registered:true,route, label});
  }
  for(const s of registry.silos) add(s.id,s.label,s.route,true);
  for(const s of watch) add(s.id,s.label||s.id,null,false);
  for(const o of approved.approved) add(o.silo,o.silo,null,false);
  // Historical checkout snapshots sometimes omit silo attribution. Never invent a silo from them.
  for(const o of live.offers) if(typeof o.silo==='string' && ID.test(o.silo)) add(o.silo,o.silo,null,false);
  const counts={HOLD_PRODUCT:0,MISSING_PRODUCT:0,LINK_CONFLICT:0,VERIFY_DELIVERY:0};
  const actions=[];
  for(const o of approved.approved) {
    const entry=entries.get(o.silo);
    if(!entry) continue;
    const product=products[o.product_id]||null;
    const liveOffer=live.offers.find(x=>x.offer_id===o.offer_id);
    const state=statusOf(o,product,liveOffer);
    if(!STATES.has(state)) throw Error('UNKNOWN_READINESS');
    const offer={offer_id:String(o.offer_id), product_id:String(o.product_id||''),name:String(o.name||''),price_nzd:Number(o.price)||null,state,action:actionFor(state,o.name),source:'BEC-PRIME/catalog/offers/approved.json',product_source:PRODUCT_ID.test(o.product_id||'')?'BEC-PRIME/catalog/products/'+o.product_id+'.json':null};
    entry.offers.push(offer);entry.offer_count++;
    counts[state]++;
    actions.push({silo_id:o.silo,offer_id:offer.offer_id,product_id:offer.product_id,state,action:offer.action,priority:{VERIFY_DELIVERY:0,LINK_CONFLICT:1,HOLD_PRODUCT:2,MISSING_PRODUCT:3}[state]});
  }
  const silos=[...entries.values()].map(s=>{
    if(s.offers.length) s.state=s.offers.every(o=>o.state==='HOLD_PRODUCT')?'HOLD_PRODUCT':s.offers.some(o=>o.state==='LINK_CONFLICT')?'LINK_CONFLICT':s.offers.some(o=>o.state==='MISSING_PRODUCT')?'MISSING_PRODUCT':'VERIFY_DELIVERY';
    s.next_action=s.offers.length?s.offers[0].action:actionFor(s.state,s.label);
    return s;
  }).sort((a,b)=>a.front.localeCompare(b.front)||a.silo_id.localeCompare(b.silo_id));
  actions.sort((a,b)=>a.priority-b.priority||a.silo_id.localeCompare(b.silo_id));
  return {
    schema:'BECK/CASH-CLOSURE/1.0',generated_at:now,
    classification:'PRIVATE_INTERNAL_REVIEW_NOT_PRODUCTION_PROOF',
    truth:{new_external_revenue_attributed_nzd:null,settled_payments_verified:null,fulfilled_orders_verified:null,reason:'No independent Stripe settlement, buyer independence, and customer delivery records were read. Never infer zero or positive revenue from static catalogues.'},
    restrictions:{external_actions:false,automatic_publication:false,automatic_price_changes:false,automatic_payments:false,silo_deletion:false,adult_tenant_data_included:false},
    counts:{silos_monitored:silos.length,registered_silos:silos.filter(x=>x.registered).length,offer_records:approved.approved.length,source_declared_checkout_count:approved.approved.filter(x=>x.payment_link_status==='ACTIVE_LIVEMODE').length,offers_by_state:counts},
    next_human_action:actions[0]||null,
    warnings:['Checkout URLs are catalogue assertions, not verified live availability.','A registry entry is not verified inventory or a paying customer.','Private watch-only projects are not automatically registered or published.'],
    source_sha256:sourceHashes,
    silos
  };
}
function render(report) {
  const rows=report.silos.map(s=>{
    const products=s.offers.map(o=>'<div class="offer"><b>'+esc(o.name)+'</b> '+(o.price_nzd==null?'':'<span>NZ$'+esc(o.price_nzd)+'</span>')+'<p><strong>'+esc(o.state)+'</strong> · '+esc(o.action)+'</p>'+(o.product_source?'<a href="https://github.com/KelpCoin/DreamLedger/blob/main/'+encodeURI(o.product_source)+'">Inspect product evidence</a>':'')+'</div>').join('');
    return '<section class="silo"><h2>'+esc(s.label)+'</h2><p class="sub">'+esc(s.silo_id)+' · '+(s.registered?'REGISTERED':'WATCH ONLY')+' · Front '+esc(s.front)+'</p><p><b>'+esc(s.state)+'</b></p>'+products+(products?'':'<p>'+esc(s.next_action)+'</p>')+'</section>';
  }).join('\n');
  const priority=report.next_human_action;
  return '<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>BECK Cash Closure | Private evidence review</title><style>body{margin:0;background:#0d1016;color:#e8edf5;font:16px/1.5 system-ui,sans-serif}main{max-width:950px;margin:auto;padding:20px}.sub,.muted{color:#b0bdce}h1{font-size:2rem;line-height:1.1}h2{margin:.2rem 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px}.silo,.hero{background:#18212b;padding:18px;border:1px solid #344252;border-radius:12px}a{color:#aed7ff}.offer{border-top:1px solid #344252;padding-top:12px;margin-top:12px}.offer span{float:right}strong{color:#ffc6a3}p{margin:.5rem 0}small{color:#b0bdce}</style></head><body><main><h1>BECK Cash Closure</h1><p class="sub">Private read-only commercial evidence | '+esc(report.generated_at)+'</p><div class="hero"><p><b>'+report.counts.silos_monitored+' silos monitored · '+report.counts.registered_silos+' registered · '+report.counts.offer_records+' approved-offer records</b></p><p><strong>Verified revenue from this report: UNKNOWN</strong>, not NZ$0 and not a claim of payment.</p><h2>Highest-priority human action</h2><p>'+(priority?esc(priority.silo_id+' / '+priority.offer_id+': '+priority.action):'No approved-offer records found. Inspect inventory before publication.')+'</p><small>No automatic contact, spending, publishing, charging or deletion.</small></div><h2>All registered and watch-only silos</h2><div class="grid">'+rows+'</div></main></body></html>';
}
function generate(root=ROOT) {
  root=path.resolve(root);
  const registry=read(root,'catalog/silos/CUBE-SILO-REGISTRY.json');
  const approved=read(root,'catalog/offers/approved.json');
  const live=read(root,'catalog/commerce-live.json');
  const watch=read(root,'economic/CashClosureWatch.json');
  if(!Array.isArray(watch.value?.lanes)) throw Error('INVALID_WATCH_LIST');
  const products={},hashes={};
  for(const [file,result] of [['catalog/silos/CUBE-SILO-REGISTRY.json',registry],['catalog/offers/approved.json',approved],['catalog/commerce-live.json',live],['economic/CashClosureWatch.json',watch]]) hashes[file]=result.sha256;
  for(const o of approved.value.approved){
    if(!PRODUCT_ID.test(o.product_id||'')) throw Error('INVALID_PRODUCT_ID');
    const rel='catalog/products/'+o.product_id+'.json';
    try{const p=read(root,rel);products[o.product_id]=p.value;hashes[rel]=p.sha256;}
    catch(e){if(e.code!=='ENOENT')throw e;}
  }
  const report=assemble({registry:registry.value,approved:approved.value,live:live.value,products,watch:watch.value.lanes,now:new Date().toISOString(),sourceHashes:hashes});
  // Consumer source audit is private and non-mutating. Dynamic routes require live checks separately.
  const publicRoot=path.resolve(root,'..','public');
  const sourceCatalog=read(path.resolve(root,'..'),'public/catalog.json');
  report.consumer_readiness=auditConsumerCatalog({
    catalog:sourceCatalog.value,registry:registry.value,approved:approved.value,
    routeExists:(route)=>{
      const rel=String(route).replace(/^\/+/,'');
      if(rel.includes('..'))return false;
      const full=path.resolve(publicRoot,rel);
      if(!(full===publicRoot||full.startsWith(publicRoot+path.sep)))return false;
      return fs.existsSync(full)&&fs.statSync(full).isFile() ||
        fs.existsSync(path.join(full,'index.html')) && fs.statSync(path.join(full,'index.html')).isFile();
    },
    qrExists:fs.existsSync(path.join(publicRoot,'qr','canonical.svg')),
    doorwayExists:fs.existsSync(path.join(publicRoot,'go','index.html'))
  });
  report.source_sha256['public/catalog.json']=sourceCatalog.sha256;

  const dir=path.join(root,'data','cash-closure');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'board.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'board.html'),render(report));
  fs.writeFileSync(path.join(dir,'consumer-readiness.json'),JSON.stringify(report.consumer_readiness,null,2)+'\n');
  process.stdout.write(JSON.stringify({status:'PRIVATE_BOARD_CREATED',counts:report.counts,top:report.next_human_action,html:'data/cash-closure/board.html'})+'\n');
  return report;
}
if(require.main===module) generate();
module.exports={assemble,statusOf,render,generate,auditConsumerCatalog};
