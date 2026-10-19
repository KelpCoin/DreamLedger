import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { probeAll } from './heartbeat.mjs';

const root = process.cwd();
const jobContract = JSON.parse(fs.readFileSync(path.join(root, 'ops/fleet/JOBS.v1.json'), 'utf8'));

async function fixtureServer(handler) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  return { server, origin: 'http://127.0.0.1:' + address.port };
}

test('fleet job contract is well-formed and explicit about consent boundaries', () => {
  assert.equal(jobContract.schema, 'dreamledger.beck-fleet-jobs/v1');
  assert.equal(jobContract.policy.human_is_not_recovery_operator, true);
  assert.equal(jobContract.policy.fail_closed_on_missing_credentials, true);
  assert.equal(jobContract.policy.production_dns_or_payment_cutover, 'explicit_owner_consent_required');
  assert.equal(jobContract.policy.generated_revenue_default_nzd, 0);
  const ids = new Set(jobContract.jobs.map(job => job.id));
  assert.equal(ids.size, jobContract.jobs.length);
  for (const job of jobContract.jobs) {
    for (const dependency of job.depends_on) assert.ok(ids.has(dependency), 'unknown dependency: ' + dependency);
    assert.ok(job.acceptance.length > 0, 'missing acceptance criteria: ' + job.id);
  }
});

test('heartbeat marks fixture routes healthy only on HTTP 200 and ready health JSON', async () => {
  const fixture = await fixtureServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/healthz') {
      res.end(JSON.stringify({ ready: true, production_ready: true }));
    } else if (req.url === '/version') {
      res.end(JSON.stringify({ commit_sha: 'fixture-commit' }));
    } else {
      res.statusCode = 200;
      res.end('{}');
    }
  });
  try {
    const result = await probeAll(fixture.origin, {
      routes: [{ path: '/healthz', label: 'health' }, { path: '/version', label: 'identity' }]
    });
    assert.equal(result.status, 'HEALTHY');
    assert.equal(result.ready, true);
    assert.equal(result.revenue_claimed_nzd, 0);
    assert.equal(result.provider_mutations, false);
    assert.equal(result.failed, 0);
  } finally {
    fixture.server.close();
  }
});

test('heartbeat fails closed when health reports degraded despite HTTP 200', async () => {
  const fixture = await fixtureServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ready: false, production_ready: false }));
  });
  try {
    const result = await probeAll(fixture.origin, { routes: [{ path: '/healthz', label: 'health' }] });
    assert.equal(result.status, 'DEGRADED');
    assert.equal(result.ready, false);
    assert.equal(result.routes[0].http_status, 200);
    assert.equal(result.routes[0].detail, 'application_reports_not_ready');
  } finally {
    fixture.server.close();
  }
});

test('heartbeat fails closed on non-200 route and never follows redirects', async () => {
  const fixture = await fixtureServer((req, res) => {
    res.writeHead(302, { location: 'https://example.invalid/' });
    res.end();
  });
  try {
    const result = await probeAll(fixture.origin, { routes: [{ path: '/healthz', label: 'health' }] });
    assert.equal(result.status, 'DEGRADED');
    assert.equal(result.routes[0].http_status, 302);
    assert.equal(result.routes[0].ok, false);
  } finally {
    fixture.server.close();
  }
});

test('heartbeat rejects origins with credentials and non-HTTPS remote origins', async () => {
  await assert.rejects(() => probeAll('http://example.com', { routes: [] }));
  await assert.rejects(() => probeAll('https://user:pass@example.com', { routes: [] }));
});
