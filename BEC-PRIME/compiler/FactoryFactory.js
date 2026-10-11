'use strict';
const fs=require('fs'); const path=require('path'); const crypto=require('crypto');
const ROOT=path.join(__dirname,'..');
const OPPS=path.join(ROOT,'compiled','opportunities','ECONOMIC_GAUNTLET.json');
const APPROVED=path.join(ROOT,'catalog','offers','approved.json');
const OUT_DIR=path.join(ROOT,'data','factory-factory'); const OUT=path.join(OUT_DIR,'FACTORY-FACTORY.json');
const sha256=v=>crypto.createHash('sha256').update(v,'utf8').digest('hex'); const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function base(source,econ,recipes){return {factory_id:'FACT-'+sha256(JSON.stringify(source)).slice(0,16).toUpperCase(),source,state:'READY_FOR_AUTHORIZED_ACQUISITION',economic_cell:econ,build_recipe:recipes,clone_recipe:['CLONE_ONLY_AFTER_VERIFIED_EXTERNAL_ECONOMIC_EVENT','PRESERVE_PROPOSITION_AND_TRUTH_BOUNDARY','CHANGE_ONE_VARIABLE_AT_A_TIME','REQUIRE_NEW_AUTHORIZATION_FOR_EXTERNAL_PUBLICATION','KILL_IF_NO_SETTLEMENT_OR_NEGATIVE_UNIT_ECONOMICS'],authority:{publication:'APPROVAL_REQUIRED',charging:'BUYER_INITIATED_ONLY',spend:'APPROVAL_REQUIRED',revenue_claim:'TRUTH_ORACLE_ONLY'},cash_density:{numerator:'VERIFIED_REVENUE_NZD',denominator:'HUMAN_ATTENTION_MINUTES + INCREMENTAL_COST_NZD',optimize:'MAXIMIZE',invalid_inputs:['UNVERIFIED_REVENUE','SIMULATED_REVENUE','INTERNAL_EVENTS']}}}
function offer(o){return base({type:'APPROVED_OFFER',offer_id:o.offer_id,product_sku:o.product_sku},{buyer:o.target_buyer||null,offer:o.name,price_nzd:Number(o.price||0),payment_rail:o.payment_adapter||'stripe',fulfillment:o.fulfillment_route||null,proof:o.proof_of_delivery||null},['READ_LIVE_OFFER','VERIFY_PAYMENT_LINK','BUILD_ONE_CHANNEL_ACQUISITION_PACKET','REQUIRE_AUTHORIZATION','PUBLISH','OBSERVE_CHECKOUT','OBSERVE_SETTLEMENT','FULFILL','VERIFY_INDEPENDENTLY','EXTRACT_MECHANISM'])}
function candidate(c){return base({type:'GAUNTLET_PASS',opportunity_id:c.opportunity_id},{buyer:c.buyer||null,offer:c.offer||null,price_nzd:Number(c.price_nzd||0),channels:c.channels||[],smallest_test:c.smallest_test||null},['RECHECK_DEMAND_EVIDENCE','CONSTRUCT_OR_REUSE_OFFER','VERIFY_FULFILLMENT','VERIFY_SETTLEMENT_RAIL','BUILD_ONE_CHANNEL_ACQUISITION_PACKET','REQUIRE_AUTHORIZATION','PUBLISH','OBSERVE_OUTCOME','FULFILL','VERIFY','EXTRACT_MECHANISM'])}
const RADAR_DOMAINS = [
  'construction procurement','IT hardware procurement','cloud infrastructure','cybersecurity operations',
  'software delivery','data quality','document processing','accounting operations','legal operations',
  'insurance administration','logistics and freight','energy operations','telecommunications',
  'manufacturing supply','maintenance and repair','facilities management','real estate operations',
  'retail operations','ecommerce operations','hospitality operations','travel operations',
  'agriculture supply','healthcare administration','education administration','media production',
  'marketing operations','translation and localization','API usage and metering','agent orchestration',
  'identity and entitlement management','observability and incident response','customer support operations',
  'sustainability reporting','compliance evidence','supplier qualification','physical goods resale'
];
function buildModularFactories(adapters, seed='SEED-DEFAULT') {
  if (!Array.isArray(adapters)) throw new TypeError('adapters must be an array');
  const rootSeed = String(seed || 'SEED-DEFAULT');
  return adapters.filter(a => a && typeof a.slug === 'string' && a.slug.trim()).map(adapter => {
    const slug = adapter.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    const digest = sha256(rootSeed + '|' + slug);
    const count = 5 + (parseInt(digest.slice(0, 2), 16) % 6);
    const instances = Array.from({length: count}, (_, index) => ({
      factory_instance_id: 'FFI-' + sha256(rootSeed + '|' + slug + '|' + index).slice(0, 20).toUpperCase(),
      adapter_slug: slug,
      fulfillment: String(adapter.fulfillment || 'UNSPECIFIED'),
      external_action: 'BLOCKED',
      authorization_required: true,
      replication_permission: false,
      truth_status: 'UNVERIFIED'
    }));
    return {
      factory_id: 'MODFACT-' + sha256(rootSeed + '|' + slug).slice(0, 16).toUpperCase(),
      adapter_slug: slug,
      fulfillment: String(adapter.fulfillment || 'UNSPECIFIED'),
      state: 'COMPILED_NOT_AUTHORIZED',
      instances
    };
  });
}
function run(){if(!fs.existsSync(OPPS))throw Error('Missing ECONOMIC_GAUNTLET.json'); if(!fs.existsSync(APPROVED))throw Error('Missing approved.json'); const opp=read(OPPS), approved=read(APPROVED); const pass=(opp.results||[]).filter(x=>x.verdict==='PASS'); const factories=[...(approved.approved||[]).filter(x=>x.payment_link_status==='ACTIVE_LIVEMODE'&&x.payment_link_url).map(offer),...pass.map(candidate)]; const payload={schema:'DREAMLEDGER/FACTORY-FACTORY/v1',generated_at_utc:new Date().toISOString(),objective:'Compile evidence-backed economic cells into repeatable bounded factories without fabricating economic truth.',doctrine:'One buyer -> one mission -> one deliverable -> one external effect -> one outcome -> learn -> replicate.',factory_count:factories.length,factories,replication_gate:{required:['external_buyer','settled_payment','correct_attribution','fulfillment','independent_proof'],status_before_first_verified_event:'LOCKED'},global_money_radar:{mode:'CONTINUOUS',scope:'DIGITAL_AND_PHYSICAL',external_action:'BLOCKED_BY_DEFAULT',domains:RADAR_DOMAINS,raw_evidence_preserved:true,deduplicate_before_scoring:true,qualified_buyer_intent_required:true,replicate_only_after_verified_external_economic_event:true},global_authority:{external_publication:'APPROVAL_REQUIRED',external_outreach:'APPROVAL_REQUIRED',spend:'APPROVAL_REQUIRED',charging:'BUYER_INITIATED_ONLY',truth:'TRUTH_ORACLE_ONLY'}}; payload.integrity_sha256=sha256(JSON.stringify(payload)); fs.mkdirSync(OUT_DIR,{recursive:true}); fs.writeFileSync(OUT,JSON.stringify(payload,null,2)+'\n'); return payload;}
if(require.main===module){const r=run(); console.log(JSON.stringify({status:'PASS',factory_count:r.factory_count,output:OUT,ids:r.factories.map(x=>x.factory_id)},null,2));}
module.exports={run,buildModularFactories};