import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {compileAuctionCloneBlueprint,AUCTION_MASTER_SILO,IMPLEMENTED_AUCTION_FORMATS}
 from "../BEC-PRIME/capabilities/auction/clone-blueprint.mjs";
const masterProof={
 master_silo:"mtg-master",template_path:"docs/MTG_MASTER_SILO.md",
 master_test_result:"PASS",master_source_sha256:"a".repeat(64)
};
const isolation={
 identity_boundary:"dedicated",database_boundary:"dedicated",
 storage_boundary:"dedicated",secrets_boundary:"dedicated",payment_boundary:"dedicated"
};
const b2b={
 silo_id:"industrial-surplus",spv_id:"industrial-market",surface_id:"industrial-deals",
 market_mode:"b2b",auction_format:"english_ascending",currency:"NZD",
 business_case:"Auction verified surplus equipment to business buyers with auditable bids, tracked shipment and settled receipts.",
 isolation,automation_adapters:["powershell","python","notion","zapier","kubernetes"]
};
const opposite={
 silo_id:"artwork-commissions",spv_id:"creative-vehicle",surface_id:"gallery-surface",
 market_mode:"b2b",auction_format:"reverse_procurement",currency:"USD",
 business_case:"B2B clients invite verified creative suppliers to compete on procurement terms, milestones and delivery proof.",
 isolation,automation_adapters:["powershell","superio"]
};
const compile=(r=b2b,m=masterProof)=>compileAuctionCloneBlueprint({request:r,masterProof:m,now:"2026-11-01T00:00:00.000Z"});
test("master reference is MTG while Kingdom owns the capability",()=>{
 const p=compile();
 assert.equal(AUCTION_MASTER_SILO,"mtg-master");
 assert.equal(p.capability_id,"kingdom.auction.v1");
 assert.equal(p.master_silo,"mtg-master");
 assert.equal(p.master_template,"docs/MTG_MASTER_SILO.md");
 assert.equal(p.target.market_mode,"b2b");
 assert.equal(p.target.silo_id,"industrial-surplus");
 assert.equal(p.status,"PREPARED_NOT_AUTHORIZED");
 assert.equal(p.gauntlet.allocation,"DENY_UNTIL_SIGNED");
});
test("same CUBE master compiles unrelated B2B sector without importing MTG inventory or branding",()=>{
 const p=compile(opposite);
 assert.equal(p.master_silo,"mtg-master");
 assert.equal(p.target.silo_id,"artwork-commissions");
 assert.equal(p.format_status,"REQUIRES_NEW_TRANSACTION_ENGINE");
 assert.ok(p.gauntlet.activation_blockers.includes("AUCTION_FORMAT_NOT_IMPLEMENTED"));
 assert.ok(p.gauntlet.activation_blockers.includes("CURRENCY_AND_PAYMENTS_ADAPTER_NOT_VERIFIED"));
 assert.equal(p.data_policy.inventory_copied,false);
 assert.equal(p.data_policy.customer_data_copied,false);
 assert.equal(p.data_policy.secrets_copied,false);
 assert.ok(!JSON.stringify(p).includes("HappyHomarid"));
});
test("format implemented on master does not authorize target deployment",()=>{
 assert.deepEqual(IMPLEMENTED_AUCTION_FORMATS,["english_ascending"]);
 const p=compile();
 assert.ok(p.gauntlet.activation_blockers.includes("TARGET_ADAPTER_AND_STORE_NOT_DEPLOYED"));
 assert.ok(p.gauntlet.activation_blockers.includes("OWNER_APPROVAL_REQUIRED"));
 assert.ok(p.gauntlet.activation_blockers.includes("TARGET_GAUNTLET_PASS_REQUIRED"));
 assert.equal(p.automation_adapters[0].enabled,false);
});
test("exact repeated input generates the same SHA256 and bytes",()=>{
 const x=compile(),y=compile();
 assert.deepEqual(x,y);
 const {blueprint_sha256,...body}=x;
 assert.equal(blueprint_sha256,createHash("sha256").update(JSON.stringify(body)).digest("hex"));
});
test("no master verified test, no master template match and no overwrite",()=>{
 assert.throws(()=>compile(b2b,{...masterProof,master_test_result:"UNKNOWN"}),/MASTER_VERIFICATION_REQUIRED/);
 assert.throws(()=>compile(b2b,{...masterProof,template_path:"other_silo.md"}),/MASTER_VERIFICATION_REQUIRED/);
 assert.throws(()=>compile({...b2b,silo_id:"mtg-master"}),/CLONE_CANNOT_OVERWRITE_MASTER/);
});
test("missing dedicated database, identity, payment or storage hard fails",()=>{
 for(const field of Object.keys(isolation)){
  assert.throws(()=>compile({...b2b,isolation:{...isolation,[field]:"shared"}}),/DEDICATED_ISOLATION_REQUIRED/);
 }
});
test("unknown auction format, market model, currency and meaningless business case fail",()=>{
 assert.throws(()=>compile({...b2b,auction_format:"fake-bidding"}),/UNKNOWN_AUCTION_FORMAT/);
 assert.throws(()=>compile({...b2b,market_mode:"all"}),/INVALID_MARKET_MODE/);
 assert.throws(()=>compile({...b2b,currency:"nzd"}),/INVALID_CURRENCY/);
 assert.throws(()=>compile({...b2b,business_case:"make millions"}),/BUSINESS_CASE_REQUIRED/);
});
test("never clone live records, account secrets or customer data",()=>{
 for(const key of ["source_customer_data","source_payment_credentials","source_media","source_inventory"]){
  assert.throws(()=>compile({...b2b,[key]:{dummy:true}}),/CLONING_USER_DATA_FORBIDDEN/);
 }
});
test("unapproved automation targets cannot be used",()=>{
 assert.throws(()=>compile({...b2b,automation_adapters:["raw-stripe-key"]}),/INVALID_AUTOMATION_ADAPTERS/);
});
