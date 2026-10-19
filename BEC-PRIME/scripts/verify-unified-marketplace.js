'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..','..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const failures=[];
function check(name,condition,detail=''){if(!condition)failures.push({name,detail});}
let registry,manifest,priorityVerticals;
try{registry=JSON.parse(read('data/777/cube-b2b-sales-hypotheses.v1.json'));}catch(e){failures.push({name:'CUBE_REGISTRY_JSON',detail:e.message});}
try{manifest=JSON.parse(read('BEC-PRIME/compiled/website/.well-known/agent-commerce.json'));}catch(e){failures.push({name:'AGENT_COMMERCE_MANIFEST_JSON',detail:e.message});}
try{priorityVerticals=JSON.parse(read('BEC-PRIME/catalog/marketplace/priority-verticals.v1.json'));}catch(e){failures.push({name:'PRIORITY_VERTICALS_JSON',detail:e.message});}
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

const verticals=priorityVerticals?.commercial_verticals||[];
const truthOracle=verticals.find(x=>x.id==='truth-oracle-paid-evidence-review');
const dreamMeez=verticals.find(x=>x.id==='dreammeez-avatar-cosmetics');
const dooh=verticals.find(x=>x.id==='programmatic-dooh-billboard');
check('PRIORITY_VERTICALS_SCHEMA',priorityVerticals?.schema==='dreamledger.marketplace.priority-verticals.v1');
check('PRIORITY_VERTICALS_COMPLETE',verticals.length===3&&!!truthOracle&&!!dreamMeez&&!!dooh,String(verticals.length));
check('TRUTH_ORACLE_AUDIT_IS_PAID_TIER',truthOracle?.audit_capability==='PAID_FEATURE_WITHIN_TRUTH_ORACLE'&&truthOracle?.standalone_audit_sku_allowed===false&&truthOracle?.new_product_price_or_payment_link_allowed_by_this_contract===false);
check('TRUTH_ORACLE_PRICES_PROPOSED_ONLY',truthOracle?.checkout_enabled===false&&truthOracle?.proposed_metered_tools?.length===3&&truthOracle.proposed_metered_tools.every(x=>x.status==='PROPOSED_NOT_LIVE'));
check('DREAMMEEZ_FAILS_CLOSED',dreamMeez?.checkout_enabled===false&&dreamMeez?.surface_state==='PREVIEW_ONLY_UNTIL_ENTITLEMENT_PROOF'&&dreamMeez?.no_browser_side_ownership_grants===true);
check('DOOH_FAILS_CLOSED',dooh?.checkout_enabled===false&&dooh?.surface_state==='PREVIEW_ONLY_UNTIL_INVENTORY_AND_PLACEMENT_PROOF'&&dooh?.required_gates?.some(x=>x.includes('finite inventory'))&&dooh?.required_gates?.some(x=>x.includes('measurement')));
check('VERTICAL_SILO_BOUNDARIES',new Set(verticals.map(x=>x.silo_id)).size===3&&priorityVerticals?.silo_rules?.no_standalone_truth_oracle_audit_sku===true&&priorityVerticals?.silo_rules?.keep_mtg_happyhomarid_collectorscoast_separate_from_amplissa_adult===true);
check('NO_CHECKOUT_LINKS_IN_VERTICAL_REGISTRY',!JSON.stringify(priorityVerticals).toLowerCase().includes('checkout_url')&&!JSON.stringify(priorityVerticals).toLowerCase().includes('payment_link'));
check('VERTICALS_ENDPOINT_FAIL_CLOSED',route.includes("'/api/marketplace/v1/verticals'")&&route.includes('PRIORITY_VERTICALS_PATH')&&route.includes('UNAVAILABLE_FAIL_CLOSED'));
check('DISCOVERY_EXPOSES_VERTICALS',route.includes("verticals:'/api/marketplace/v1/verticals'"));
check('AGENT_MANIFEST_VERTICALS',manifest?.endpoints?.priority_verticals==='https://dreamledger.org/api/marketplace/v1/verticals');
check('PUBLIC_PAGE_USES_VERTICALS_ENDPOINT',page.includes('id="commercial-verticals"')&&page.includes("getJson('/api/marketplace/v1/verticals')")&&page.includes('loadPriorityVerticals()'));
check('ECONOMIC_STATUS_NOT_VALIDATED',priorityVerticals?.economic_validation?.verified_external_revenue_nzd===0&&priorityVerticals?.economic_validation?.status==='NOT_ECONOMICALLY_VALIDATED');

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
check('AUCTION_SCHEMA',sql.includes('marketplace_auctions')&&sql.includes('marketplace_bids')&&sql.includes('marketplace_place_bid')&&sql.includes('marketplace_close_auction')&&sql.includes('marketplace_buy_now'));
check('AUCTION_HUMAN_AUTH',sql.includes('explicit human bid authorization required')&&route.includes("lacks place_bid scope"));
check('AUCTION_CATALOG_UI',page.includes('/api/marketplace/v1/auctions')&&page.includes('Timed auctions'));
check('PARTY_APPLICATIONS',route.includes('/api/marketplace/v1/party-applications')&&route.includes('marketplace_apply_party')&&sql.includes('marketplace_approve_party'));
check('BUYER_BOUND_RFQ',route.includes('p_buyer_party_id:buyer?.party_id||null')&&sql.includes('offer is not assigned to this buyer'));
check('CUBE_ADMIN_INTAKE',route.includes('/api/marketplace/v1/admin/cube-hypotheses')&&route.includes('DREAMLEDGER/CUBE-SALES-HYPOTHESES/v1'));
check('CUBE_SEED_MIGRATION',migrations.some(x=>x.includes('003_seed_cube_b2b_hypotheses'))&&sql.includes('marketplace_cube_hypotheses'));
check('LEDGER_APPEND_SERIALIZED',sql.includes('pg_advisory_xact_lock(777771)'));
check('PAGE_USES_REAL_API',page.includes('/api/marketplace/v1/listings')&&page.includes('/api/marketplace/v1/rfqs'));
check('PAGE_NO_FAKE_SUPPLIERS',page.includes('No placeholder listings have been fabricated.'));
check('AGENT_MANIFEST_HAS_A2A',manifest?.endpoints?.agent_intents==='https://dreamledger.org/api/marketplace/v1/agent-intents');
check('SETTLEMENT_NOT_CONFUSED_WITH_RFQ',registry?.guardrails?.no_claim_of_verified_revenue_until_settlement_fulfillment_delivery_and_independent_evidence_reconcile===true);
if(failures.length){console.error(JSON.stringify({status:'FAIL',failures},null,2));process.exit(1);}
console.log(JSON.stringify({status:'PASS_STATIC_CONTRACT_ONLY',hypotheses:registry.hypotheses.length,priority_counts:counts,migrations_checked:migrations.length,priority_verticals_checked:verticals.length,priority_vertical_checkout_authorized:verticals.filter(x=>x.checkout_enabled===true).length,truth_oracle_standalone_audit_sku_allowed:false,verified_revenue_nzd:0,live_buyer_intents_created:0},null,2));
