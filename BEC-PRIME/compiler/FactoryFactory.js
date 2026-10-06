'use strict';
const fs=require('fs'); const path=require('path'); const crypto=require('crypto');
const ROOT=path.join(__dirname,'..');
const OPPS=path.join(ROOT,'compiled','opportunities','ECONOMIC_GAUNTLET.json');
const APPROVED=path.join(ROOT,'catalog','offers','approved.json');
const EVERGREEN=path.join(ROOT,'..','public','evergreen-silo-factory.json');
const OUT_DIR=path.join(ROOT,'data','factory-factory'); const OUT=path.join(OUT_DIR,'FACTORY-FACTORY.json');
const sha256=v=>crypto.createHash('sha256').update(v,'utf8').digest('hex'); const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function base(source,econ,recipes){return {factory_id:'FACT-'+sha256(JSON.stringify(source)).slice(0,16).toUpperCase(),source,state:'READY_FOR_AUTHORIZED_ACQUISITION',economic_cell:econ,build_recipe:recipes,clone_recipe:['CLONE_ONLY_AFTER_VERIFIED_EXTERNAL_ECONOMIC_EVENT','PRESERVE_PROPOSITION_AND_TRUTH_BOUNDARY','CHANGE_ONE_VARIABLE_AT_A_TIME','REQUIRE_NEW_AUTHORIZATION_FOR_EXTERNAL_PUBLICATION','KILL_IF_NO_SETTLEMENT_OR_NEGATIVE_UNIT_ECONOMICS'],authority:{publication:'APPROVAL_REQUIRED',charging:'BUYER_INITIATED_ONLY',spend:'APPROVAL_REQUIRED',revenue_claim:'TRUTH_ORACLE_ONLY'},cash_density:{numerator:'VERIFIED_REVENUE_NZD',denominator:'HUMAN_ATTENTION_MINUTES + INCREMENTAL_COST_NZD',optimize:'MAXIMIZE',invalid_inputs:['UNVERIFIED_REVENUE','SIMULATED_REVENUE','INTERNAL_EVENTS']}}}
function offer(o){return base({type:'APPROVED_OFFER',offer_id:o.offer_id,product_sku:o.product_sku},{buyer:o.target_buyer||null,offer:o.name,price_nzd:Number(o.price||0),payment_rail:o.payment_adapter||'stripe',fulfillment:o.fulfillment_route||null,proof:o.proof_of_delivery||null},['READ_LIVE_OFFER','VERIFY_PAYMENT_LINK','BUILD_ONE_CHANNEL_ACQUISITION_PACKET','REQUIRE_AUTHORIZATION','PUBLISH','OBSERVE_CHECKOUT','OBSERVE_SETTLEMENT','FULFILL','VERIFY_INDEPENDENTLY','EXTRACT_MECHANISM'])}
function candidate(c){return base({type:'GAUNTLET_PASS',opportunity_id:c.opportunity_id},{buyer:c.buyer||null,offer:c.offer||null,price_nzd:Number(c.price_nzd||0),channels:c.channels||[],smallest_test:c.smallest_test||null},['RECHECK_DEMAND_EVIDENCE','CONSTRUCT_OR_REUSE_OFFER','VERIFY_FULFILLMENT','VERIFY_SETTLEMENT_RAIL','BUILD_ONE_CHANNEL_ACQUISITION_PACKET','REQUIRE_AUTHORIZATION','PUBLISH','OBSERVE_OUTCOME','FULFILL','VERIFY','EXTRACT_MECHANISM'])}

const BATCH_MIN=5;
const BATCH_MAX=10;
const LANES=['PROBLEM_FIRST','AUDIT_FIRST','SAVINGS_FIRST','RISK_FIRST','OUTCOME_FIRST'];
const TELEMETRY=['exposures','qualified_clicks','checkout_starts','settled_payments','fulfilled_orders','verified_outcomes','acquisition_cost_nzd','fulfillment_cost_nzd','human_touches','time_to_fulfill','margin_nzd'];
function buildModularFactories(adapters, seed='UNBOUND-SEED') {
  return (Array.isArray(adapters)?adapters:[]).map((a,i)=>{
    const slug=String(a.slug||a.id||('factory-'+(i+1))).toUpperCase().replace(/[^A-Z0-9]+/g,'-');
    const factory_id='FACTORY-'+slug;
    const instances=Array.from({length:BATCH_MIN},(_,n)=>{
      const id='FI-'+sha256(JSON.stringify({factory_id,seed,variant:n+1})).slice(0,20).toUpperCase();
      return {factory_instance_id:id,factory_id,variant_number:n+1,state:'PROBING',authority:'ALLOCATION_ONLY',marketing_lane:LANES[n%LANES.length],telemetry_schema:TELEMETRY,promotion_gate:'VERIFIED_EXTERNAL_OUTCOME_REQUIRED',kill_gate:'NO_QUALIFIED_DEMAND_OR_NO_FULFILLMENT_PROOF',truth_status:'UNVERIFIED',external_action:'BLOCKED',replication_permission:false,registry_authority:'SUPABASE_CUBE_SILO_REGISTRY'};
    });
    return {factory_id,mechanism_family:String(a.fulfillment||'ECONOMIC_ANALYSIS').toUpperCase(),capability_adapter:a.slug||a.id||null,substrate_source:'EVERGREEN_SILO_FACTORY',variant_batch_size:BATCH_MIN,max_variant_batch_size:BATCH_MAX,lanes:LANES,instances};
  });
}

function run(){if(!fs.existsSync(OPPS))throw Error('Missing ECONOMIC_GAUNTLET.json'); if(!fs.existsSync(APPROVED))throw Error('Missing approved.json'); const opp=read(OPPS), approved=read(APPROVED); const pass=(opp.results||[]).filter(x=>x.verdict==='PASS'); const modular=buildModularFactories((fs.existsSync(EVERGREEN)?read(EVERGREEN).live_adapters:[]), pass[0]?.opportunity_id||'UNBOUND-SEED'); const factories=[...(approved.approved||[]).filter(x=>x.payment_link_status==='ACTIVE_LIVEMODE'&&x.payment_link_url).map(offer),...pass.map(candidate)]; const payload={schema:'DREAMLEDGER/FACTORY-FACTORY/v1',generated_at_utc:new Date().toISOString(),objective:'Compile evidence-backed economic cells into repeatable bounded factories without fabricating economic truth.',doctrine:'One buyer -> one mission -> one deliverable -> one external effect -> one outcome -> learn -> replicate.',factory_count:factories.length,modular_factory_count:modular.length,modular_factory_instance_count:modular.reduce((n,x)=>n+x.instances.length,0),factories,modular_factories:modular,replication_gate:{required:['external_buyer','settled_payment','correct_attribution','fulfillment','independent_proof'],status_before_first_verified_event:'LOCKED'},global_authority:{external_publication:'APPROVAL_REQUIRED',external_outreach:'APPROVAL_REQUIRED',spend:'APPROVAL_REQUIRED',charging:'BUYER_INITIATED_ONLY',truth:'TRUTH_ORACLE_ONLY'}}; payload.integrity_sha256=sha256(JSON.stringify(payload)); fs.mkdirSync(OUT_DIR,{recursive:true}); fs.writeFileSync(OUT,JSON.stringify(payload,null,2)+'\n'); return payload;}
if(require.main===module){const r=run(); console.log(JSON.stringify({status:'PASS',factory_count:r.factory_count,output:OUT,ids:r.factories.map(x=>x.factory_id)},null,2));}
module.exports={run,buildModularFactories};