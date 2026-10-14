#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const read = p => JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const fail = message => { console.error('FAIL '+message); process.exitCode=1; };
const mission = read('ops/cube-swarm/revenue-ladder-10.json');
const catalog = read('public/catalog.json');
if(mission.offers.length!==10) fail('expected exactly 10 offers, got '+mission.offers.length);
const ids=new Set(), skus=new Set();
for(const item of mission.offers){
  try {
    const def=read(item.definition_path);
    const contract=def.commercial_contract;
    if(def.silo_id!==item.silo_id) fail(item.silo_id+': silo_id mismatch');
    if(ids.has(def.silo_id)) fail('duplicate silo_id '+def.silo_id); ids.add(def.silo_id);
    if(skus.has(contract.sku)) fail('duplicate SKU '+contract.sku); skus.add(contract.sku);
    if(contract.sku!==item.sku) fail(item.silo_id+': manifest SKU mismatch');
    if(Math.round(contract.amount_minor/100)!==item.price_nzd) fail(item.silo_id+': amount mismatch');
    if(def.lifecycle!=='CANDIDATE') fail(item.silo_id+': lifecycle must stay CANDIDATE');
    if(def.provisioning?.mode!=='DRY_RUN_ONLY'||def.provisioning?.deploy_allowed!==false) fail(item.silo_id+': provisioning must fail closed');
    if(def.source_evidence?.source_hashing!=='BUILD_WORKER_MUST_COMPUTE_SHA256_AT_EXECUTION') fail(item.silo_id+': source hashing rule missing');
    if(!Array.isArray(def.source_evidence?.source_refs)||def.source_evidence.source_refs.length===0) fail(item.silo_id+': source refs missing');
    const p=catalog.products.find(x=>x.id===item.product_id);
    if(!p) fail(item.silo_id+': catalog product not found');
    else {
      if(p.sku!==item.sku) fail(item.silo_id+': catalog SKU mismatch');
      if(Number(p.price)!==item.price_nzd) fail(item.silo_id+': catalog price mismatch');
      if(String(p.currency).toLowerCase()!=='nzd') fail(item.silo_id+': catalog currency mismatch');
      if(item.catalog_state==='GATED_CANDIDATE' && (p.status!=='gated'||p.checkout_available!==false||p.checkout_url!==null)) fail(item.silo_id+': candidate must be gated with no checkout URL');
    }
    if(item.catalog_state==='GATED_CANDIDATE' && (def.commercial_contract.checkout_status!=='NOT_CONFIGURED'||def.carousel_card.visible!==false)) fail(item.silo_id+': candidate checkout/card must be disabled');
    if(!item.task_issue) fail(item.silo_id+': task issue missing');
  } catch(e) { fail(item.silo_id+': '+e.message); }
}
if(mission.execution_rules?.live_checkout_allowed!==false||mission.execution_rules?.production_deployment_allowed!==false) fail('execution gates must remain false');
if(process.exitCode) process.exit(process.exitCode);
console.log('PASS revenue-ladder contract: 10 offers, unique IDs/SKUs, catalog parity, candidate checkout gates, dry-run provisioning.');
