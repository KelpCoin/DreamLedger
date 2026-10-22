#!/usr/bin/env node
/**
 * Read-only BECK fleet heartbeat. No provider mutations, no credentials in proof.
 * Exit 0 only when every required route is healthy; writes a redacted JSON proof.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROUTES = [
  { path: '/', label: 'storefront' },
  { path: '/healthz', label: 'health' },
  { path: '/version', label: 'deployment_identity' },
  { path: '/billboard', label: 'billboard' },
  { path: '/mtg/', label: 'mtg_master_silo' },
  { path: '/api/toll/v1/manifest', label: 'agent_bridge_manifest' },
  { path: '/data/mtg-catalog.json', label: 'mtg_catalog' },
  { path: '/silos/mtg/silo.json', label: 'mtg_silo_manifest' }
];

function safeOrigin(raw) {
  const u = new URL(raw);
  if (u.protocol !== 'https:' && u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') {
    throw new Error('origin must use HTTPS except for loopback test fixtures');
  }
  if (u.username || u.password) throw new Error('origin must not contain credentials');
  return u;
}

export async function probeAll(origin, options = {}) {
  const base = safeOrigin(origin);
  const timeoutMs = options.timeoutMs || 10000;
  const routes = options.routes || ROUTES;
  const results = [];
  for (const route of routes) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const url = new URL(route.path, base);
    const started = Date.now();
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { accept: 'application/json,text/html;q=0.9,*/*;q=0.1', 'user-agent': 'BECK-Fleet-Heartbeat/1.0' }
      });
      let applicationReady = true;
      let detail = null;
      if (route.path === '/healthz' && response.headers.get('content-type')?.includes('application/json')) {
        try {
          const body = await response.json();
          if (body && (body.ready === false || body.production_ready === false)) {
            applicationReady = false;
            detail = 'application_reports_not_ready';
          }
        } catch {
          applicationReady = false;
          detail = 'health_json_unparseable';
        }
      }
      if (route.path === '/version' && response.headers.get('content-type')?.includes('application/json')) {
        try {
          const body = await response.json();
          if (!body || !(body.commit_sha || body.version || body.sha)) {
            applicationReady = false;
            detail = 'deployment_identity_missing';
          }
        } catch {
          applicationReady = false;
          detail = 'version_json_unparseable';
        }
      }
      results.push({
        label: route.label,
        path: route.path,
        http_status: response.status,
        ok: response.status === 200 && applicationReady,
        duration_ms: Date.now() - started,
        content_type: response.headers.get('content-type'),
        detail
      });
    } catch (error) {
      results.push({
        label: route.label,
        path: route.path,
        http_status: 0,
        ok: false,
        duration_ms: Date.now() - started,
        error_class: error?.name || 'FetchError'
      });
    } finally {
      clearTimeout(timer);
    }
  }

  const failed = results.filter(item => !item.ok);
  return {
    schema: 'dreamledger.beck-fleet-heartbeat/v1',
    observed_at_utc: new Date().toISOString(),
    origin: base.origin,
    status: failed.length === 0 ? 'HEALTHY' : 'DEGRADED',
    ready: failed.length === 0,
    checked: results.length,
    failed: failed.length,
    routes: results,
    revenue_claimed_nzd: 0,
    provider_mutations: false,
    note: 'HTTP reachability is not settlement proof, database persistence proof, or route-parity acceptance.'
  };
}

async function main() {
  const origin = process.env.BECK_HEARTBEAT_ORIGIN || 'https://dreamledger.org';
  const outPath = process.env.BECK_HEARTBEAT_PATH || 'proof/fleet/heartbeat.json';
  const proof = await probeAll(origin);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'degraded=' + String(!proof.ready) + '\n', 'utf8');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'status=' + proof.status + '\n', 'utf8');
  }
  process.exitCode = proof.ready ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    const outPath = process.env.BECK_HEARTBEAT_PATH || 'proof/fleet/heartbeat.json';
    const proof = {
      schema: 'dreamledger.beck-fleet-heartbeat/v1',
      observed_at_utc: new Date().toISOString(),
      status: 'BLOCKED_CONFIGURATION',
      ready: false,
      error_class: error?.name || 'Error',
      error_message: String(error?.message || 'heartbeat failed').slice(0, 240),
      revenue_claimed_nzd: 0,
      provider_mutations: false
    };
    try {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(proof, null, 2) + '\n', 'utf8');
    } catch {}
    console.error(JSON.stringify(proof, null, 2));
    process.exitCode = 2;
  });
}
