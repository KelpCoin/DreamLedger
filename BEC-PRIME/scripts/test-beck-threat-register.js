"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../..");
const threat=JSON.parse(fs.readFileSync(path.join(root,"IP/BECK/redteam-seven-new-failures-20261028.json"),"utf8"));
assert.equal(threat.schema,"beck/redteam-threat-register/v3");
assert.equal(threat.owner_gate,"NO_PUBLIC_SECURITY_CERTIFICATION");
assert(threat.entries.length>=7);
const keys=new Set();
for(const entry of threat.entries){
  assert(entry.id&&entry.key&&!keys.has(entry.key));keys.add(entry.key);
  assert.equal(entry.public_claim_allowed,false);
  assert.equal(entry.approval_required,true);
  assert(entry.source_status&&entry.blocking_test&&entry.marketing_claim);
  if(entry.source_url)assert.equal(new URL(entry.source_url).protocol,"https:");
  assert(!/PRODUCTION_SAFE|COMPLETED_DEPLOYMENT/.test(entry.state));
}
for(const key of ["X402_SIWX_RESOURCE_MISMATCH","AP2_CONTEXT_AND_MANDATE","INDIRECT_PROMPT_INJECTION","GGUF_TEMPLATE_SUPPLY_CHAIN","STRIPE_DUPLICATE_FULFILLMENT","POWERSHELL_TASK_PERSISTENCE","PERSISTENT_MEMORY_POISONING"])assert(keys.has(key));
for(const key of ["MCP_PARASITIC_TOOLCHAIN","MCP_SILENT_REGISTRY_DRIFT","SEAL_PERSISTENT_TOOL_POISONING","AP2_INTENT_BOUND_CART","X402_FREE_SHOPPING_FACILITATOR","REGISTRY_CREDENTIALS_AND_MODEL_SWAP","PYTORCH_CHECKPOINT_UNSAFE_LOAD","CROSS_LAYER_GOAL_HIJACK"])assert(keys.has(key));
assert(threat.entries.length===17);
assert(threat.model_independence.objective.includes("ChatGPT is optional"));
assert(threat.first_transaction_blockers.some(x=>x.includes("403")));
const stripe=fs.readFileSync(path.join(root,"BEC-PRIME/lib/stripeWebhookProof.js"),"utf8");
assert(stripe.includes("delivery_status: 'PENDING', fulfilled: false"));
console.log("BECK_SEVEN_NEW_THREATS_REGISTER=PASS; CLAIMS_PUBLIC=0; LIVE_SECURITY_PROOF=UNVERIFIED");
