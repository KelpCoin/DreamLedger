#!/usr/bin/env node
// Staging-only shadow replacement for the legacy 15-minute heartbeat.
// This does not provide parity with Supabase cube_radar_runs or permit cutover.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SCHEMA = 'dreamledger.neon-shadow-heartbeat/v1';
const AGENT = 'beck-neon-shadow';
export function slotFor(when = new Date()) {
  const t = new Date(when).getTime();
  if (!Number.isFinite(t)) throw new Error('INVALID_CLOCK');
  return new Date(Math.floor(t / 900000) * 900000).toISOString();
}
export function makeHeartbeat(slot = slotFor()) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:(00|15|30|45):00\.000Z$/.test(slot)) throw new Error('INVALID_SLOT');
  const sequence = Math.floor(Date.parse(slot) / 900000);
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('INVALID_SEQUENCE');
  const heartbeatId = 'cube-shadow-' + slot.replace(/[-:.]/g, '');
  const payload = {
    schema: SCHEMA, mode: 'SHADOW_ONLY', agent_id: AGENT, slot_utc: slot,
    source_table: 'cortex_heartbeat', equivalent_to_supabase_cube_radar_runs: false,
    approved_for_production_cutover: false, external_actions: 0, revenue_claimed_nzd: 0
  };
  const serialized = JSON.stringify(payload);
  const hash = crypto.createHash('sha256').update(serialized).digest('hex');
  return { heartbeatId, slot, sequence, serialized, hash };
}
export function buildSql(r) {
  if (!/^cube-shadow-\d{8}T\d{6}000Z$/.test(r.heartbeatId)) throw new Error('INVALID_HEARTBEAT_ID');
  if (!/^[a-f0-9]{64}$/.test(r.hash)) throw new Error('INVALID_HASH');
  if (!Number.isSafeInteger(r.sequence) || r.sequence < 1) throw new Error('INVALID_SEQUENCE');
  if (r.serialized !== makeHeartbeat(r.slot).serialized) throw new Error('INVALID_PAYLOAD');
  return [
    'WITH inserted AS (',
    ' INSERT INTO public.cortex_heartbeat',
    '  (heartbeat_id,seq,current_hash,previous_hash,agent_id,observed_at_utc,payload)',
    " VALUES ('" + r.heartbeatId + "'," + r.sequence + ",'" + r.hash + "',NULL,'" + AGENT + "','" + r.slot + "'::timestamptz,'" + r.serialized + "'::jsonb)",
    ' ON CONFLICT (heartbeat_id) DO NOTHING',
    ' RETURNING current_hash,payload',
    '), observed AS (',
    " SELECT current_hash,payload,'INSERTED'::text AS disposition FROM inserted",
    ' UNION ALL',
    " SELECT current_hash,payload,'EXISTING'::text AS disposition FROM public.cortex_heartbeat WHERE heartbeat_id='" + r.heartbeatId + "'",
    ') SELECT disposition,current_hash,payload->>\'mode\' FROM observed LIMIT 1;'
  ].join('\n');
}
export function interpretReadback(stdout, expectedHash) {
  const rows = String(stdout || '').trim().split(/\r?\n/).filter(Boolean);
  if (rows.length !== 1) return {ok:false,status:'BLOCKED_MISSING_OR_MULTIPLE_READBACK'};
  const cols = rows[0].split('|');
  if (cols.length !== 3) return {ok:false,status:'BLOCKED_READBACK_FORMAT'};
  const [disposition, hash, mode] = cols;
  if (!['INSERTED','EXISTING'].includes(disposition) || hash !== expectedHash || mode !== 'SHADOW_ONLY')
    return {ok:false,status:'BLOCKED_READBACK_MISMATCH'};
  return {ok:true,status:disposition === 'INSERTED' ? 'SHADOW_PERSISTED' : 'SHADOW_ALREADY_PRESENT'};
}
export function connectionEnv(raw, environment = process.env) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('INVALID_DATABASE_URL'); }
  if (!['postgres:', 'postgresql:'].includes(u.protocol) || !u.hostname.endsWith('.neon.tech') || !u.username || !u.password || !u.pathname || u.pathname === '/')
    throw new Error('INVALID_NEON_CONNECTION');
  if (u.port && u.port !== '5432') throw new Error('INVALID_NEON_PORT');
  if (u.searchParams.has('sslmode') && !['require','verify-full'].includes(u.searchParams.get('sslmode')))
    throw new Error('TLS_REQUIRED');
  return {...environment,PGHOST:u.hostname,PGPORT:u.port || '5432',
    PGDATABASE:decodeURIComponent(u.pathname.slice(1)),PGUSER:decodeURIComponent(u.username),
    PGPASSWORD:decodeURIComponent(u.password),PGSSLMODE:'require',PGCONNECT_TIMEOUT:'8'};
}
export function executeHeartbeat(options={}) {
  const env=options.env || process.env, now=options.now || new Date();
  const record=makeHeartbeat(slotFor(now));
  const base={schema:SCHEMA,observed_at_utc:new Date(now).toISOString(),slot_utc:record.slot,
    heartbeat_id:record.heartbeatId,mode:'SHADOW_ONLY',equivalent_to_legacy_radar:false,
    source_data_migrated:false,production_cutover_authorized:false,external_actions:0,
    revenue_claimed_nzd:0,production_mutations:false};
  if (env.BECK_NEON_SHADOW_ENABLED !== 'true')
    return {...base,status:'HELD_NOT_ENABLED',persisted:false};
  if (env.BECK_NEON_TARGET !== 'migration-staging' || env.BECK_ALLOW_STAGING_HEARTBEAT_WRITE !== 'true')
    return {...base,status:'BLOCKED_STAGING_WRITE_POLICY',persisted:false};
  if (!env.NEON_SHADOW_STAGING_DATABASE_URL)
    return {...base,status:'BLOCKED_MISSING_STAGING_DATABASE_URL',persisted:false};
  let pg;
  try { pg=connectionEnv(env.NEON_SHADOW_STAGING_DATABASE_URL,env); }
  catch(e) { return {...base,status:'BLOCKED_INVALID_CONNECTION',error_class:e.message,persisted:false}; }
  const result=(options.spawn || spawnSync)('psql',
    ['-X','-w','-A','-t','-F','|','-v','ON_ERROR_STOP=1','-c',buildSql(record)],
    {env:pg,encoding:'utf8',timeout:12000,maxBuffer:2048,stdio:['ignore','pipe','pipe']});
  if (result.error || result.status !== 0)
    return {...base,status:'BLOCKED_DATABASE_WRITE_OR_READBACK',
      error_class:result.error?.code === 'ENOENT' ? 'PSQL_NOT_INSTALLED':'PSQL_OPERATION_FAILED',persisted:false};
  const check=interpretReadback(result.stdout,record.hash);
  return {...base,status:check.status,persisted:check.ok,idempotent_readback_verified:check.ok};
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result=executeHeartbeat();
  const proof=process.env.BECK_SHADOW_PROOF_PATH || 'proof/fleet/neon-shadow-heartbeat.json';
  fs.mkdirSync(path.dirname(proof),{recursive:true});
  fs.writeFileSync(proof,JSON.stringify(result,null,2)+'\n',{encoding:'utf8',mode:0o600});
  console.log(JSON.stringify(result,null,2));
  process.exitCode = result.persisted || result.status === 'HELD_NOT_ENABLED' ? 0 : 2;
}
