import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('container uses Node 24 and the canonical engine build', () => {
  const docker = read('Dockerfile.render-exit');
  assert.match(docker, /FROM node:24-bookworm-slim/);
  assert.match(docker, /npm run --prefix BEC-PRIME build/);
  assert.match(docker, /ops\/migration\/render-exit\/start\.sh/);
  assert.match(docker, /GIT_COMMIT/);
});

test('engine listener can be bound privately without changing its default', () => {
  const server = read('BEC-PRIME/start.js');
  const entry = read('ops/migration/render-exit/start.sh');
  assert.match(server, /const HOST = String\(process\.env\.HOST \|\| '0\.0\.0\.0'\)/);
  assert.match(server, /capturedServer\.listen\(PORT,HOST,/);
  assert.match(entry, /PORT=3000 HOST=127\.0\.0\.1 node/);
  assert.match(entry, /PORT=8080 ENGINE_INTERNAL_URL=/);
});

test('engine must answer health before the public listener starts', () => {
  const entry = read('ops/migration/render-exit/start.sh');
  assert.ok(entry.indexOf('http://127.0.0.1:3000/healthz') < entry.indexOf('PORT=8080 ENGINE_INTERNAL_URL='));
  assert.match(entry, /ENGINE_HEALTH_TIMEOUT/);
  assert.match(entry, /BLOCKED_CHILD_PROCESS_EXITED/);
});

test('persistent paths are mounted under /var/data', () => {
  const entry = read('ops/migration/render-exit/start.sh');
  const fly = read('fly.render-exit.toml');
  assert.match(entry, /DATA_ROOT="\/var\/data"/);
  for (const dir of ['ledger', 'proofs', 'qr', 'dreamiez', 'demand', 'jobs', 'bec-proofs', 'bec-prime-data']) {
    assert.ok(entry.includes('"$DATA_ROOT/' + dir + '"'), 'missing persistent path ' + dir);
  }
  assert.match(fly, /destination = "\/var\/data"/);
  assert.match(fly, /source = "dreamledger_data"/);
});

test('only the storefront port is configured as public', () => {
  const fly = read('fly.render-exit.toml');
  assert.match(fly, /internal_port = 8080/);
  assert.doesNotMatch(fly, /internal_port = 3000/);
  assert.match(fly, /auto_stop_machines = "off"/);
  assert.match(fly, /min_machines_running = 1/);
});

test('migration contract explicitly blocks production mutation', () => {
  const contract = JSON.parse(read('ops/migration/render-exit/RENDER-EXIT-CONTRACT.json'));
  assert.equal(contract.status, 'SCAFFOLD_PREPARED_NOT_DEPLOYED');
  assert.equal(contract.non_actions.fly_resources_created, false);
  assert.equal(contract.non_actions.production_deployed, false);
  assert.equal(contract.non_actions.dns_changed, false);
  assert.equal(contract.non_actions.stripe_config_changed, false);
  assert.equal(contract.non_actions.render_deleted_or_disabled, false);
  assert.equal(contract.non_actions.production_mutation, false);
});
