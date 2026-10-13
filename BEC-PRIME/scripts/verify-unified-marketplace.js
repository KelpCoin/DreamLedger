'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..','..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const failures=[];
function check(name,condition,detail=''){if(!condition)failures.push({name,detail});}
let registry,manifest;
try{registry=JSON.parse(read('data/777/cube-b2b-sales-hypotheses.v1.json'));}catch(e){failures.push({name:'CUBE_REGISTRY_JSON',detail:e.message});}
try{manifest=JSON.parse(read('BEC-PRIME/compiled/website/.well-known/agent-commerce.json'));}catch(e){failures.push({name:'AGENT_COMMERCE_MANIFEST_JSON',detail:e.message});}
const route=read('BEC-PRIME/routes/marketplaceKernel.js');
const start=read('BEC-PRIME/start.js');
const page=read('BEC-PRIME/compiled/website/marketplace.html');
const migrationDir=path.join(root,'supabase','migrations');
const migrations=fs.readdirSync(migrationDir).filter(x=>x.startsWith('20261013000')&&x.endsWith('.sql')).sort();
const sql=migrations.map(x=>fs.readFileSync(path.join(migrationDir,x),'utf8')).join('\n');
check('CUBE_REGISTRY_SCHEMA',registry?.schema_version==='dreamledger.cube.sales-hypothesis-swarm.v1');
check('CUBE_REGISTRY_COUNT',registry?.hypotheses?.length===36,String(registry?.hypotheses?.length));
check('CUBE_REGISTRY_UNVALIDATED',registry?.hypotheses?.every(x=>x.status==='HYPOTHESIS_UNVALIDATED'));
const counts=(registry?.hypotheses||[]).reduce((a,x)=>(a[x.priority]=(a[x.priority]||0)+1,a),{});
check('CUBE_PRIORITY_COUNTS',counts.P1===14&&counts.P2===18&&counts.P3===4,JSON.stringify(counts));
check('NO_QUBE_MISSPELLING',!/\bQUBE\b|\bQube\b/.test(JSON.stringify(registry)));
for(const endpoint of ['/api/marketplace/v1/discovery','/api/marketplace/v1/status','/api/marketplace/v1/listings','/api/marketplace/v1/rfqs','/api/marketplace/v1/agent-intents','/api/marketplace/v1/evidence']) check('ROUTE_'+endpoint,route.includes(endpoint));
for(const token of ['marketplace_submit_listing','marketplace_submit_offer','marketplace_accept_offer','marketplace_prepare_checkout','marketplace_settle_checkout','marketplace_record_delivery','marketplace_accept_delivery']) check('RPC_'+token,sql.includes(token)||route.includes(token));
check('RUNTIME_ROUTE_WIRED',start.includes('marketplaceKernel.handle(req,res,requestPath)'));
check('STRIPE_WEBHOOK_WIRED',start.includes('marketplaceKernel.handleStripeWebhook(raw,req.headers[\'stripe-signature\'])'));
check('STRIPE_SIGNATURE_VALIDATION',route.includes('timingSafeEqual')&&route.includes('marketplace_settle_checkout'));
check('IDEMPOTENT_WEBHOOK_INBOX',sql.includes('primary key(provider,event_id)')&&sql.includes('on conflict(provider,event_id) do nothing'));
check('LEDGER_HASH_CHAIN',sql.includes('previous_hash')&&sql.includes('event_hash')&&sql.includes('digest('));
check('RLS_ENABLED',sql.includes('alter table public.marketplace_orders enable row level security')&&sql.includes('alter table public.marketplace_ledger_events enable row level security'));
check('LOCAL_LEDGER_ENCRYPTED',route.includes('aes-256-gcm')&&route.includes('MARKETPLACE_LOCAL_ENCRYPTION_KEY'));
check('LOCAL_LEDGER_CHAIN_VERIFIED',route.includes('decodeLocalLine')&&route.includes('envelopeHash'));
check('DYNAMIC_CREDENTIALS_HASHED',sql.includes('marketplace_api_credentials')&&sql.includes('token_hash text not null unique'));
check('CREDENTIAL_SCOPE_GATES',route.includes("lacks submit_listing scope")&&route.includes("lacks checkout scope")&&route.includes("lacks agent_intent scope"));
check('CONNECT_ONBOARDING_GATED',route.includes('MARKETPLACE_ENABLE_CONNECT_ONBOARDING')&&route.includes('account_links'));
check('CONNECT_DESTINATION_CHARGE',route.includes('payment_intent_data[transfer_data][destination]')&&route.includes('payment_intent_data[application_fee_amount]'));
check('CHECKOUT_FAILS_CLOSED',route.includes('CHECKOUT_HELD'));
check('CUBE_SEED_MIGRATION',migrations.some(x=>x.includes('003_seed_cube_b2b_hypotheses'))&&sql.includes('marketplace_cube_hypotheses'));
check('LEDGER_APPEND_SERIALIZED',sql.includes('pg_advisory_xact_lock(777771)'));
check('PAGE_USES_REAL_API',page.includes('/api/marketplace/v1/listings')&&page.includes('/api/marketplace/v1/rfqs'));
check('PAGE_NO_FAKE_SUPPLIERS',page.includes('No placeholder listings have been fabricated.'));
check('AGENT_MANIFEST_HAS_A2A',manifest?.endpoints?.agent_intents==='https://dreamledger.org/api/marketplace/v1/agent-intents');
check('SETTLEMENT_NOT_CONFUSED_WITH_RFQ',registry?.guardrails?.no_claim_of_verified_revenue_until_settlement_fulfillment_delivery_and_independent_evidence_reconcile===true);
if(failures.length){console.error(JSON.stringify({status:'FAIL',failures},null,2));process.exit(1);}
console.log(JSON.stringify({status:'PASS_STATIC_CONTRACT_ONLY',hypotheses:registry.hypotheses.length,priority_counts:counts,migrations_checked:migrations.length,verified_revenue_nzd:0,live_buyer_intents_created:0},null,2));
