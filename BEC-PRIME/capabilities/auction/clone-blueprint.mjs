// Kingdom auction CUBE blueprint compiler.
// MTG is the quality master template. A clone is an isolated proposal, NEVER a live auction.
// No network, secrets, customer data, payment creation, deployment or publication.
import {createHash} from "node:crypto";

const CAPABILITY="kingdom.auction.v1";
const MASTER="mtg-master";
const TEMPLATE="docs/MTG_MASTER_SILO.md";
const MODES=new Set(["b2b","b2c","c2c","internal"]);
const FORMATS=new Set(["english_ascending","reverse_procurement","sealed_bid","dutch_descending","bulk_lot"]);
const IMPLEMENTED=new Set(["english_ascending"]);
const ADAPTERS=new Set(["powershell","python","zapier","notion","superio","kubernetes"]);
const SLUG=/^[a-z][a-z0-9_-]{1,63}$/;
const SHA=/^[a-f0-9]{64}$/;
const sha=s=>createHash("sha256").update(s).digest("hex");
const fail=x=>{throw Error("AUCTION_BLUEPRINT_"+x)};
const validSlug=(s,key)=>typeof s==="string"&&SLUG.test(s)?s:fail("INVALID_"+key);
const ordered=obj=>Object.fromEntries(Object.keys(obj).sort().map(k=>[k,obj[k]]));

export function compileAuctionCloneBlueprint({
  request, masterProof, now="2026-11-01T00:00:00.000Z"
}={}){
 if(!request||typeof request!=="object"||Array.isArray(request))fail("INVALID_REQUEST");
 if(!masterProof||typeof masterProof!=="object"||masterProof.master_silo!==MASTER||
  masterProof.template_path!==TEMPLATE||masterProof.master_test_result!=="PASS"||
  !SHA.test(masterProof.master_source_sha256||""))fail("MASTER_VERIFICATION_REQUIRED");
 if(!Number.isFinite(Date.parse(now)))fail("INVALID_CLOCK");
 const silo_id=validSlug(request.silo_id,"SILO");
 const spv_id=validSlug(request.spv_id,"SPV");
 const surface_id=validSlug(request.surface_id,"SURFACE");
 if(silo_id===MASTER)fail("CLONE_CANNOT_OVERWRITE_MASTER");
 if(!MODES.has(request.market_mode))fail("INVALID_MARKET_MODE");
 if(!FORMATS.has(request.auction_format))fail("UNKNOWN_AUCTION_FORMAT");
 const currency=request.currency;
 if(typeof currency!=="string"||!/^[A-Z]{3}$/.test(currency))fail("INVALID_CURRENCY");
 if(typeof request.business_case!=="string"||request.business_case.trim().length<30||
    request.business_case.trim().length>2000)fail("BUSINESS_CASE_REQUIRED");
 const resources=request.isolation;
 if(!resources||typeof resources!=="object"||
  resources.identity_boundary!=="dedicated"||
  resources.database_boundary!=="dedicated"||
  resources.storage_boundary!=="dedicated"||
  resources.secrets_boundary!=="dedicated"||
  resources.payment_boundary!=="dedicated")fail("DEDICATED_ISOLATION_REQUIRED");
 if(!Array.isArray(request.automation_adapters)||
  request.automation_adapters.some(x=>!ADAPTERS.has(x)))fail("INVALID_AUTOMATION_ADAPTERS");
 if(request.source_customer_data||request.source_payment_credentials||request.source_media||
  request.source_inventory)fail("CLONING_USER_DATA_FORBIDDEN");
 const formatReady=IMPLEMENTED.has(request.auction_format);
 const sameCurrency=currency==="NZD";
 const activationBlockers=[
  "OWNER_APPROVAL_REQUIRED",
  "TARGET_GAUNTLET_PASS_REQUIRED",
  "TARGET_ADAPTER_AND_STORE_NOT_DEPLOYED",
  "INDEPENDENT_TARGET_IDENTITY_PAYMENT_SECURITY_TESTS_REQUIRED",
  "PRODUCTION_RELIABILITY_EVIDENCE_REQUIRED"
 ];
 if(!formatReady)activationBlockers.push("AUCTION_FORMAT_NOT_IMPLEMENTED");
 if(!sameCurrency)activationBlockers.push("CURRENCY_AND_PAYMENTS_ADAPTER_NOT_VERIFIED");
 const core={
  schema:"kingdom/auction-clone-blueprint/v1",
  capability_id:CAPABILITY,
  master_silo:MASTER,
  master_template:TEMPLATE,
  master_proof_sha256:masterProof.master_source_sha256,
  target:ordered({silo_id,spv_id,surface_id,market_mode:request.market_mode,
    auction_format:request.auction_format,currency}),
  commercial_hypothesis:request.business_case.trim(),
  automation_adapters:[...new Set(request.automation_adapters)].sort().map(id=>({
   id,enabled:false,requires:"separately approved executor and scoped credentials"
  })),
  status:"PREPARED_NOT_AUTHORIZED",
  format_status:formatReady?"MASTER_IMPLEMENTED_ADAPTER_ONLY":"REQUIRES_NEW_TRANSACTION_ENGINE",
  data_policy:{
   customer_data_copied:false,inventory_copied:false,media_copied:false,secrets_copied:false,
   inherited:["quality_gates","transaction_interfaces","test_specs","evidence_envelope","release_contract"],
   independent:["identity","database","storage","secrets","payment","commercial_ledger","public_brand"]
  },
  gauntlet:{
   allocation:"DENY_UNTIL_SIGNED",
   reference_scorecard:"gauntlet-scorecard/v1",
   target_scorecard_mandatory:true,
   owner_explicit_approval_mandatory:true,
   zero_bypass:true,
   activation_blockers:activationBlockers
  },
  master_quality_floor:[
   "identity_and_RLS","inventory_evidence","immutable_bid_and_deadline","idempotent_order",
   "payment_reconciliation","shipment_acceptance","disputes","cross_silo_denial",
   "customer_data_isolation","cost_and_margin_proof"
  ],
  proposed_at:now
 };
 return {...core,blueprint_sha256:sha(JSON.stringify(core))};
}
export const AUCTION_MASTER_SILO=MASTER;
export const IMPLEMENTED_AUCTION_FORMATS=Object.freeze([...IMPLEMENTED]);
