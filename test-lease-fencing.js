import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import pg from 'pg';

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
const TEST_COMMAND = 'node --test test-lease-fencing.js';
const RUN_ID = process.env.DOMINO_RUN_ID || crypto.randomUUID();
const PROOF_PATH = process.env.DOMINO_PROOF_PATH || 'proof-domino02.json';

if (!DATABASE_URL) throw new Error('DOMINO02_DATABASE_URL_REQUIRED');

const client = new Client({ connectionString: DATABASE_URL });
const state = {
  pass: 0,
  fail: 0,
  ownerA: 'UNOBSERVABLE',
  ownerB: 'UNOBSERVABLE',
  initialToken: 'UNOBSERVABLE',
  reclaimedToken: 'UNOBSERVABLE',
  staleWrite: 'UNOBSERVABLE',
  currentWrite: 'UNOBSERVABLE',
  idempotency: 'UNOBSERVABLE',
  concurrentClaim: 'UNOBSERVABLE'
};

async function sql(text, values = []) {
  const r = await client.query(text, values);
  return r.rows;
}

async function check(fn) {
  try {
    await fn();
    state.pass++;
  } catch (e) {
    state.fail++;
    throw e;
  }
}

async function resetTask(id) {
  await sql('DELETE FROM public.economic_actions WHERE id = $1', [id]);
  await sql('INSERT INTO public.economic_actions (id, result, claimed_by, lease_expires_at, fencing_token) VALUES ($1, NULL, NULL, NULL, 0)', [id]);
}

const task = crypto.randomUUID();
const raceTask = crypto.randomUUID();
const resultA = { worker: 'A', value: 'first' };
const resultB = { worker: 'B', value: 'second' };

await client.connect();
await resetTask(task);
await resetTask(raceTask);

test('TEST 01 valid claim succeeds', async () => check(async () => {
  const r = (await sql('SELECT * FROM public.domino02_claim_task($1,$2,$3)', [task, 'worker-A', 60]))[0];
  assert.equal(r.claimed, true);
  assert.equal(r.result_code, 'CLAIMED');
  assert.equal(r.worker, 'worker-A');
  assert.equal(Number(r.fencing_token), 1);
  state.ownerA = r.worker;
  state.initialToken = String(r.fencing_token);
}));

test('TEST 02 second worker cannot claim unexpired lease', async () => check(async () => {
  const r = (await sql('SELECT * FROM public.domino02_claim_task($1,$2,$3)', [task, 'worker-B', 60]))[0];
  assert.equal(r.claimed, false);
  assert.equal(r.result_code, 'LEASE_ACTIVE');
}));

test('TEST 03 expired lease can be reclaimed', async () => check(async () => {
  await sql("UPDATE public.economic_actions SET lease_expires_at = clock_timestamp() - interval '1 second' WHERE id = $1", [task]);
  const r = (await sql('SELECT * FROM public.domino02_claim_task($1,$2,$3)', [task, 'worker-B', 60]))[0];
  assert.equal(r.claimed, true);
  assert.equal(r.result_code, 'RECLAIMED');
  assert.equal(r.worker, 'worker-B');
  state.ownerB = r.worker;
  state.reclaimedToken = String(r.fencing_token);
}));

test('TEST 04 reclaim increments fencing token', async () => check(async () => {
  assert.equal(state.initialToken, '1');
  assert.equal(state.reclaimedToken, '2');
}));

test('TEST 05 old worker becomes fenced', async () => check(async () => {
  const row = (await sql('SELECT claimed_by, fencing_token FROM public.economic_actions WHERE id=$1', [task]))[0];
  assert.equal(row.claimed_by, 'worker-B');
  assert.equal(Number(row.fencing_token), 2);
}));

test('TEST 06 old worker stale completion is rejected', async () => check(async () => {
  const r = (await sql('SELECT * FROM public.domino02_complete_task($1,$2,$3,$4)', [task, 'worker-A', 1, JSON.stringify(resultA)]))[0];
  assert.equal(r.accepted, false);
  assert.equal(r.result_code, 'REJECT_STALE_WRITE');
  state.staleWrite = r.result_code;
  const row = (await sql('SELECT result FROM public.economic_actions WHERE id=$1', [task]))[0];
  assert.equal(row.result, null);
}));

test('TEST 07 new worker completes with current token', async () => check(async () => {
  const r = (await sql('SELECT * FROM public.domino02_complete_task($1,$2,$3,$4)', [task, 'worker-B', 2, JSON.stringify(resultB)]))[0];
  assert.equal(r.accepted, true);
  assert.equal(r.result_code, 'COMPLETED');
  state.currentWrite = r.result_code;
  assert.deepEqual(r.final_result, resultB);
}));

test('TEST 08 new worker retry is idempotent', async () => check(async () => {
  const r = (await sql('SELECT * FROM public.domino02_complete_task($1,$2,$3,$4)', [task, 'worker-B', 2, JSON.stringify(resultB)]))[0];
  assert.equal(r.accepted, true);
  assert.equal(r.result_code, 'IDEMPOTENT_RETRY');
  state.idempotency = r.result_code;
  const rows = await sql('SELECT result FROM public.economic_actions WHERE id=$1', [task]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].result, resultB);
}));

test('TEST 09 concurrent claim has exactly one successful owner', async () => check(async () => {
  await resetTask(raceTask);
  const [a, b] = await Promise.all([
    sql('SELECT * FROM public.domino02_claim_task($1,$2,$3)', [raceTask, 'race-A', 60]),
    sql('SELECT * FROM public.domino02_claim_task($1,$2,$3)', [raceTask, 'race-B', 60])
  ]);
  const rows = [a[0], b[0]];
  const winners = rows.filter(x => x.claimed === true);
  assert.equal(winners.length, 1);
  assert.equal(new Set(winners.map(x => String(x.fencing_token))).size, 1);
  const persisted = (await sql('SELECT claimed_by, fencing_token FROM public.economic_actions WHERE id=$1', [raceTask]))[0];
  assert.equal(Number(persisted.fencing_token), 1);
  assert.equal(persisted.claimed_by, winners[0].worker);
  state.concurrentClaim = 'EXACTLY_ONE_SUCCESS';
}));

test('TEST 10 worker cannot use another worker token', async () => check(async () => {
  const fresh = crypto.randomUUID();
  await resetTask(fresh);
  const c = (await sql('SELECT * FROM public.domino02_claim_task($1,$2,$3)', [fresh, 'owner-C', 60]))[0];
  assert.equal(Number(c.fencing_token), 1);
  const r = (await sql('SELECT * FROM public.domino02_complete_task($1,$2,$3,$4)', [fresh, 'owner-D', 1, JSON.stringify({ bad: true })]))[0];
  assert.equal(r.accepted, false);
  assert.equal(r.result_code, 'REJECT_STALE_WRITE');
  const persisted = (await sql('SELECT result, claimed_by, fencing_token FROM public.economic_actions WHERE id=$1', [fresh]))[0];
  assert.equal(persisted.result, null);
  assert.equal(persisted.claimed_by, 'owner-C');
  assert.equal(Number(persisted.fencing_token), 1);
}));

after(async () => {
  const testSha = createHash('sha256').update(fs.readFileSync(new URL('./test-lease-fencing.js', import.meta.url))).digest('hex');
  const proof = {
    DOMINO_ID: 'DOMINO-02',
    RUN_ID,
    COMMIT_SHA: process.env.GITHUB_SHA || 'UNOBSERVABLE',
    TEST_FILE_SHA256: testSha,
    TEST_COMMAND,
    EXIT_CODE: state.fail === 0 ? 0 : 1,
    PASS_COUNT: state.pass,
    FAIL_COUNT: state.fail,
    LEASE_OWNER_A: state.ownerA,
    LEASE_OWNER_B: state.ownerB,
    INITIAL_FENCING_TOKEN: state.initialToken,
    RECLAIMED_FENCING_TOKEN: state.reclaimedToken,
    STALE_WRITE_RESULT: state.staleWrite,
    CURRENT_WRITE_RESULT: state.currentWrite,
    IDEMPOTENCY_RESULT: state.idempotency,
    CONCURRENT_CLAIM_RESULT: state.concurrentClaim,
    TIMESTAMP_UTC: new Date().toISOString()
  };
  fs.writeFileSync(PROOF_PATH, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  await client.end();
});
