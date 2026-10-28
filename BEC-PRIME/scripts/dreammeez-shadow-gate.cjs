"use strict";
// Public-safe, dependency-free, read-only gate for DreamMeez original cosmetic hypotheses.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const base=path.resolve(__dirname,"../..");
const file=path.join(base,"IP/DreamMeez/shadow-cosmetics-20261028.json");
const obj=JSON.parse(fs.readFileSync(file,"utf8"));
assert.equal(obj.schema,"beck/dreammeez-shadow-cosmetics/v1");
assert.equal(obj.silo,"dreammeez");
assert.equal(obj.checkout_enabled,false);
assert.equal(obj.automatic_publication,false);
assert.equal(obj.classification,"INTERNAL_RESEARCH_ONLY");
assert(Array.isArray(obj.items)&&obj.items.length>=12);
const names=new Set();
for(const item of obj.items){
  assert(/^SHADOW-DREAMMEEZ-[A-Z0-9_]+$/.test(item.shadow_sku));
  assert(!names.has(item.shadow_sku));names.add(item.shadow_sku);
  assert(item.proposed_nzd>0&&item.proposed_nzd<=20);
  assert(item.name&&item.distinctive_original_concept&&item.market_category_signal);
  assert.equal(item.state,"SHADOW_UNBUILT");
  assert.equal(item.checkout_enabled,false);
  assert.equal(item.public_listing,false);
  assert.equal(item.owner_approved_to_publish,false);
  assert.equal(item.artwork_stages.artist_approved,false);
  assert.equal(item.artwork_stages.ai_output_approved,false);
  assert.equal(item.artwork_stages.entitlement_tested,false);
  if(item.evidence_class!=="unverified_hypothesis"){
    const url=new URL(item.evidence_url);
    assert.equal(url.hostname,"newsroom.snap.com");
    assert.equal(url.protocol,"https:");
  }
}
const sha=crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
console.log(JSON.stringify({contract:"BECK_DREAMMEEZ_HANDDRAWN_SHADOW",status:"PASS",records:obj.items.length,source_sha256:sha,original_assets_verified:0,payments_verified:0,public_listings:0,ai_enhancements_completed:0},null,2));
