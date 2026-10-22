import test from 'node:test';
import assert from 'node:assert/strict';
import {slotFor,makeHeartbeat,buildSql,interpretReadback,executeHeartbeat,connectionEnv} from './neon-shadow-heartbeat.mjs';

const at = new Date('2026-10-21T04:31:03Z');
test('15-minute slot and deterministic evidence', () => {
  assert.equal(slotFor(at), '2026-10-21T04:30:00.000Z');
  assert.equal(slotFor('2026-10-21T04:44:59Z'), slotFor(at));
  assert.deepEqual(makeHeartbeat(slotFor(at)), makeHeartbeat(slotFor(at)));
});
test('one-statement idempotent insert with readback', () => {
  const sql=buildSql(makeHeartbeat(slotFor(at)));
  assert.match(sql,/ON CONFLICT \(heartbeat_id\) DO NOTHING/);
  assert.match(sql,/FROM observed LIMIT 1/);
  assert.match(sql,/SHADOW_ONLY/);
  assert.doesNotMatch(sql,/DELETE|DROP TABLE|TRUNCATE|stripe|charge/i);
});
test('disabled until staging and explicit write guard both set', () => {
  assert.equal(executeHeartbeat({now:at,env:{}}).status,'HELD_NOT_ENABLED');
  const e={BECK_NEON_SHADOW_ENABLED:'true'};
  assert.equal(executeHeartbeat({now:at,env:e}).status,'BLOCKED_STAGING_WRITE_POLICY');
  assert.equal(executeHeartbeat({now:at,env:{...e,BECK_NEON_TARGET:'migration-staging',BECK_ALLOW_STAGING_HEARTBEAT_WRITE:'true'}}).status,'BLOCKED_MISSING_STAGING_DATABASE_URL');
});
test('readback insists on matching hash and noncommercial mode', () => {
  const h=makeHeartbeat(slotFor(at)).hash;
  assert.equal(interpretReadback('INSERTED|'+h+'|SHADOW_ONLY\n',h).status,'SHADOW_PERSISTED');
  assert.equal(interpretReadback('EXISTING|'+h+'|SHADOW_ONLY\n',h).status,'SHADOW_ALREADY_PRESENT');
  assert.equal(interpretReadback('EXISTING|'+'0'.repeat(64)+'|SHADOW_ONLY\n',h).status,'BLOCKED_READBACK_MISMATCH');
  assert.equal(interpretReadback('EXISTING|'+h+'|PAID\n',h).status,'BLOCKED_READBACK_MISMATCH');
});
test('TLS Neon endpoint enforced', () => {
  const env=connectionEnv('postgresql://beck:example@ep-abc.neon.tech/neondb?sslmode=require',{});
  assert.equal(env.PGSSLMODE,'require');
  assert.throws(()=>connectionEnv('postgresql://beck:example@notneon.example/neondb'));
  assert.throws(()=>connectionEnv('postgresql://beck:example@ep-abc.neon.tech/neondb?sslmode=disable'));
});
test('fake psql exercises insert, repeat, collision and failure safely', () => {
  const h=makeHeartbeat(slotFor(at)).hash;
  const env={BECK_NEON_SHADOW_ENABLED:'true',BECK_NEON_TARGET:'migration-staging',
    BECK_ALLOW_STAGING_HEARTBEAT_WRITE:'true',
    NEON_SHADOW_STAGING_DATABASE_URL:'postgres://beck:secret@ep-abc.neon.tech/neondb'};
  for(const [stdout,code,status] of [
    ['INSERTED|'+h+'|SHADOW_ONLY\n',0,'SHADOW_PERSISTED'],
    ['EXISTING|'+h+'|SHADOW_ONLY\n',0,'SHADOW_ALREADY_PRESENT'],
    ['EXISTING|'+'0'.repeat(64)+'|SHADOW_ONLY\n',0,'BLOCKED_READBACK_MISMATCH'],
    ['',1,'BLOCKED_DATABASE_WRITE_OR_READBACK']
  ]) {
    const got=executeHeartbeat({now:at,env,spawn:(cmd,args,opts)=>{
      assert.equal(cmd,'psql');
      assert.equal(opts.env.PGPASSWORD,'secret');
      return {stdout,status:code};
    }});
    assert.equal(got.status,status);
    assert.equal(got.revenue_claimed_nzd,0);
    assert.equal(got.production_cutover_authorized,false);
    assert.ok(!JSON.stringify(got).includes('secret'));
  }
});
