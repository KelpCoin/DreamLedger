import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {evaluate,writeProof,verifyProof} from './provider-residue-gate.mjs';
const sample=()=>({
 r:{provider:'Render',non_preview_services_listed:12,services_suspended_by_billing:10,services_not_suspended:2,active_scheduled_jobs_calling_the_legacy_database_platform:1,public_static_site_still_served_by_legacy_host:1},
 s:{source_platform:{provider:'Supabase',data_export_performed:false},edge_function_source_scan:{active_functions_listed:66,function_sources_inspected:66,distinct_source_referenced_table_names:76,rpc_dependencies_detected:27,source_scan_complete:true},database_staging:{source_schema_imported:false,source_rows_imported:false,production_cutover:false}}
});
test('real provider inventory is HOLD, next gate is heartbeat parity',()=>{
 const {r,s}=sample(),d=evaluate(r,s,'2026-10-21T10:30:00Z');
 assert.equal(d.verdict,'HOLD_NO_PROVIDER_REMOVAL_PROVEN');
 assert.equal(d.next_gate,'PROVE_REPLACEMENT_HEARTBEAT_PARITY_AND_LEASE_IDEMPOTENCY');
 assert.equal(d.observed.supabase_active_functions,66);
 assert.equal(d.observed.render_not_suspended,2);
});
test('billing suspension is not a migration',()=>{
 const {r,s}=sample();r.services_suspended_by_billing=12;r.services_not_suspended=0;r.active_scheduled_jobs_calling_the_legacy_database_platform=0;r.public_static_site_still_served_by_legacy_host=0;
 const d=evaluate(r,s);assert(d.reasons.includes('G16_BILLING_SUSPENSION_IS_NOT_MIGRATION'));
});
test('no provider service alone cannot prove safe financial cutover',()=>{
 const {r,s}=sample();Object.assign(r,{non_preview_services_listed:0,services_suspended_by_billing:0,services_not_suspended:0,active_scheduled_jobs_calling_the_legacy_database_platform:0,public_static_site_still_served_by_legacy_host:0});
 s.source_platform.data_export_performed=true;Object.assign(s.database_staging,{source_schema_imported:true,source_rows_imported:true,production_cutover:true});
 assert.equal(evaluate(r,s).verdict,'HOLD_NO_PROVIDER_REMOVAL_PROVEN');
});
test('inconsistent Render inventory is rejected',()=>{
 const {r,s}=sample();r.services_not_suspended=10;assert.throws(()=>evaluate(r,s),/INCONSISTENT_RENDER/);
});
test('missing export truth does not default to pass',()=>{
 const {r,s}=sample();delete s.source_platform.data_export_performed;assert.throws(()=>evaluate(r,s),/UNKNOWN_BOOLEAN/);
});
test('overcounted function scan rejected',()=>{
 const {r,s}=sample();s.edge_function_source_scan.function_sources_inspected=67;assert.throws(()=>evaluate(r,s),/INCONSISTENT_SUPABASE/);
});
test('proof is hashed and tampering rejected',()=>{
 const {r,s}=sample(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'dl-provider-'));
 try{
 const f=path.join(dir,'receipt.json'),hash=writeProof(evaluate(r,s),f);
 assert.equal(verifyProof(f).sha256,hash);fs.appendFileSync(f,'tampered');
 assert.throws(()=>verifyProof(f),/PROOF_HASH_MISMATCH/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('unexpected provider identity fails closed',()=>{
 const {r,s}=sample();r.provider='Elsewhere';assert.throws(()=>evaluate(r,s),/INVALID_INVENTORY/);
});