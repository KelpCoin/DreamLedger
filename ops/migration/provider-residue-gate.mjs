#!/usr/bin/env node
// Read-only Render/Supabase residue audit. This is NOT cutover acceptance.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const number=(v,k)=>{if(!Number.isSafeInteger(v)||v<0)throw Error('INVALID_COUNT_'+k);return v;};
const bool=(v,k)=>{if(v!==true&&v!==false)throw Error('UNKNOWN_BOOLEAN_'+k);return v;};
export function evaluate(render,supabase,at=new Date().toISOString()){
 if(!render||!supabase||render.provider!=='Render'||supabase.source_platform?.provider!=='Supabase')throw Error('INVALID_INVENTORY');
 if(!Number.isFinite(Date.parse(at)))throw Error('INVALID_CLOCK');
 const total=number(render.non_preview_services_listed,'total');
 const suspended=number(render.services_suspended_by_billing,'suspended');
 const active=number(render.services_not_suspended,'active');
 const cron=number(render.active_scheduled_jobs_calling_the_legacy_database_platform,'cron');
 const site=number(render.public_static_site_still_served_by_legacy_host,'site');
 if(suspended+active!==total||cron>active||site>active)throw Error('INCONSISTENT_RENDER');
 const functions=number(supabase.edge_function_source_scan?.active_functions_listed,'functions');
 const scanned=number(supabase.edge_function_source_scan?.function_sources_inspected,'scanned');
 const tables=number(supabase.edge_function_source_scan?.distinct_source_referenced_table_names,'tables');
 const rpc=number(supabase.edge_function_source_scan?.rpc_dependencies_detected,'rpc');
 if(scanned>functions)throw Error('INCONSISTENT_SUPABASE');
 const exported=bool(supabase.source_platform?.data_export_performed,'exported');
 const schema=bool(supabase.database_staging?.source_schema_imported,'schema');
 const rows=bool(supabase.database_staging?.source_rows_imported,'rows');
 const cutover=bool(supabase.database_staging?.production_cutover,'cutover');
 const complete=bool(supabase.edge_function_source_scan?.source_scan_complete,'scan_complete');
 const reasons=[];
 if(cron)reasons.push('G16_ACTIVE_RENDER_CRON_REQUIRES_VERIFIED_REPLACEMENT');
 if(site)reasons.push('G16_RENDER_PUBLIC_ORIGIN_NOT_RETIRED');
 if(suspended)reasons.push('G16_BILLING_SUSPENSION_IS_NOT_MIGRATION');
 if(!complete||scanned!==functions)reasons.push('G17_SOURCE_FUNCTION_INVENTORY_INCOMPLETE');
 if(!exported)reasons.push('G17_NO_VERIFIED_SOURCE_DATA_EXPORT');
 if(!schema||!rows)reasons.push('G17_NO_SOURCE_SCHEMA_AND_ROW_RECONCILIATION');
 if(!cutover)reasons.push('G17_LEGACY_PRODUCTION_CUTOVER_NOT_PROVEN');
 reasons.push('G16_G17_INDEPENDENT_ROUTE_PAYMENT_BACKUP_AND_ROLLBACK_PROOF_REQUIRED');
 return {schema:'dreamledger.provider-residue-gate.v1',observed_at_utc:at,mode:'READ_ONLY',
  source_snapshot_at_utc:{render:render.generated_at_utc||null,supabase:supabase.generated_at_utc||null},
  observed:{render_services:total,render_billing_suspended:suspended,render_not_suspended:active,
   render_legacy_cron:cron,render_legacy_static_origin:site,supabase_active_functions:functions,
   supabase_sources_scanned:scanned,supabase_referenced_table_names:tables,supabase_rpc_dependencies:rpc,
   source_export_performed:exported,source_schema_imported:schema,source_rows_imported:rows},
  verdict:'HOLD_NO_PROVIDER_REMOVAL_PROVEN',reasons,
  next_gate:cron?'PROVE_REPLACEMENT_HEARTBEAT_PARITY_AND_LEASE_IDEMPOTENCY':
   !exported?'OBTAIN_ALL_SCHEMA_SOURCE_BACKUP_AND_RESTORE_EVIDENCE':'PROVE_NEON_ROW_PARITY_CLOUDFLARE_RUNTIME_AND_STRIPE_DELIVERY',
  allowed_actions:['READ_ONLY_INSPECTION','PRIVATE_TESTS','PRIVATE_DRAFT_FIX'],
  forbidden_without_approval:['RETIRE_RENDER','DELETE_SUPABASE','DNS_CUTOVER','STRIPE_MUTATION','PUBLICATION','SPEND'],
  verified_external_revenue_nzd:'NOT_RECONCILED_BY_THIS_GATE',production_mutations_performed:false};
}
export function writeProof(report,destination) {
 const raw=Buffer.from(JSON.stringify(report,null,2)+'\n');
 fs.mkdirSync(path.dirname(destination),{recursive:true});
 fs.writeFileSync(destination,raw,{mode:0o600});
 const hash=sha256(raw);
 fs.writeFileSync(destination+'.sha256',hash+'\n',{mode:0o600});
 return hash;
}
export function verifyProof(destination) {
 const raw=fs.readFileSync(destination);
 const got=sha256(raw),expected=fs.readFileSync(destination+'.sha256','utf8').trim();
 if(got!==expected||!(/^[a-f0-9]{64}$/.test(expected)))throw Error('PROOF_HASH_MISMATCH');
 const d=JSON.parse(raw.toString());
 if(d.schema!=='dreamledger.provider-residue-gate.v1'||d.verdict!=='HOLD_NO_PROVIDER_REMOVAL_PROVEN'||d.production_mutations_performed!==false)throw Error('PROOF_SHAPE_MISMATCH');
 return {verified:true,sha256:got,verdict:d.verdict};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{
  const args=process.argv.slice(2),v=(key,def)=>{const i=args.indexOf(key);return i<0?def:args[i+1];};
  const proof=v('--proof',process.env.PROVIDER_RESIDUE_PROOF_PATH||'proof/migration/provider-residue-latest.json');
  if(args.includes('--verify'))console.log(JSON.stringify(verifyProof(proof)));
  else{
   const r=JSON.parse(fs.readFileSync(v('--render','ops/migration/RENDER-SERVICE-INVENTORY-20261021.json')));
   const s=JSON.parse(fs.readFileSync(v('--supabase','ops/migration/SUPABASE-EDGE-FUNCTION-INVENTORY-20261021.json')));
   const d=evaluate(r,s),hash=writeProof(d,proof);
   console.log(JSON.stringify({verdict:d.verdict,next_gate:d.next_gate,reasons:d.reasons,proof,sha256:hash}));
  }
 }catch(e){console.error(JSON.stringify({status:'BLOCKED_VALIDATION',error_class:e.message}));process.exitCode=2;}
}