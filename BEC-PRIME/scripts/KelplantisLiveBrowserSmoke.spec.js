'use strict';

const { test, expect } = require('playwright/test');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'compiled', 'universal', 'game', 'kelplantis-mvp');
const PROOF_DIR = path.join(ROOT, 'RUN-PROOFS');
const PROOF_PATH = path.join(PROOF_DIR, 'KELPLANTIS-LIVE-BROWSER-E2E-PROOF.json');
const SUPABASE_URL = process.env.KELPLANTIS_SUPABASE_URL || '';
const ANON_KEY = process.env.KELPLANTIS_SUPABASE_ANON_KEY || '';
const PLAYER_TOKEN = process.env.KELPLANTIS_PLAYER_TOKEN || '';
let server;
let baseUrl;

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
      const file = pathname === '/' ? path.join(OUT, 'index.html') : path.join(OUT, pathname.replace(/^\//, ''));
      if (!file.startsWith(OUT) || !fs.existsSync(file)) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}/`;
      resolve();
    });
  });
}

function writeProof(proof) {
  const body = JSON.stringify(proof, null, 2) + '\n';
  const finalProof = { ...proof, evidence_sha256: sha256(body) };
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  fs.writeFileSync(PROOF_PATH, JSON.stringify(finalProof, null, 2) + '\n', 'utf8');
}

test.beforeAll(async () => {
  if (!SUPABASE_URL || !ANON_KEY || !PLAYER_TOKEN) throw new Error('Live E2E requires KELPLANTIS_SUPABASE_URL, KELPLANTIS_SUPABASE_ANON_KEY and KELPLANTIS_PLAYER_TOKEN.');
  if (!fs.existsSync(path.join(OUT, 'index.html'))) throw new Error('Kelplantis artifact missing. Run the target compiler first.');
  await startServer();
});

test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

test('Kelplantis Floor 1 live authoritative browser journey', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));

  await page.addInitScript(({ url, key, token }) => {
    window.__KELPLANTIS_CONFIG__ = { url, anonKey: key };
    sessionStorage.setItem('kelplantis_player_token', token);
  }, { url: SUPABASE_URL, key: ANON_KEY, token: PLAYER_TOKEN });

  await page.goto(baseUrl, { waitUntil: 'load' });
  await expect(page.locator('h1')).toHaveText('Kelplantis');
  await expect(page.locator('#authority')).toHaveText('AUTHORITY: SUPABASE');

  const before = await page.evaluate(async () => {
    const token = sessionStorage.getItem('kelplantis_player_token');
    const cfg = window.__KELPLANTIS_CONFIG__;
    const response = await fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/rpc/kelplantis_get_floor_gate', {
      method: 'POST', headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token, p_floor_id: 2 })
    });
    return { status: response.status, gate: await response.json() };
  });
  expect(before.gate.unlocked).toBe(false);

  const illegal = await page.evaluate(async () => {
    const token = sessionStorage.getItem('kelplantis_player_token');
    const cfg = window.__KELPLANTIS_CONFIG__;
    const response = await fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/rpc/kelplantis_enter_floor', {
      method: 'POST', headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token, p_floor_id: 2 })
    });
    return { status: response.status, body: await response.text() };
  });
  expect(illegal.status).not.toBe(200);

  await page.getByRole('button', { name: 'Enter Dungeon' }).click();
  await page.getByRole('button', { name: 'Engage' }).click();
  await page.getByRole('button', { name: 'Attack' }).click();

  let unlocked = false;
  for (let cycle = 0; cycle < 8 && !unlocked; cycle += 1) {
    for (let attack = 0; attack < 10; attack += 1) {
      await page.getByRole('button', { name: 'Attack' }).click();
      await page.waitForTimeout(25);
      const gateText = await page.locator('#gate').textContent();
      if (gateText.includes('unlocked')) { unlocked = true; break; }
    }
    if (!unlocked) {
      await page.getByRole('button', { name: 'Engage' }).click().catch(() => {});
    }
  }

  expect(unlocked).toBe(true);
  await expect(page.locator('#world')).toContainText('changed_after_first_clear');
  await expect(page.locator('#gate')).toContainText('unlocked');

  const after = await page.evaluate(async () => {
    const token = sessionStorage.getItem('kelplantis_player_token');
    const cfg = window.__KELPLANTIS_CONFIG__;
    async function rpc(name, args) {
      const r = await fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/rpc/' + name, {
        method: 'POST', headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(args)
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    }
    return {
      player: await rpc('kelplantis_get_player', { p_token: token }),
      progress: await rpc('kelplantis_get_floor_progress', { p_token: token }),
      gate: await rpc('kelplantis_get_floor_gate', { p_token: token, p_floor_id: 2 }),
      world: await rpc('kelplantis_get_world_state', { p_world_key: 'floor1' })
    };
  });

  expect(after.progress.highest_unlocked_floor).toBeGreaterThanOrEqual(2);
  expect(after.gate.unlocked).toBe(true);
  expect(after.player.floor_progress['1'].bossDefeated).toBe(true);

  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(100);
  await expect(page.locator('#authority')).toHaveText('AUTHORITY: SUPABASE');
  await expect(page.locator('#gate')).toContainText('unlocked');
  await expect(page.locator('#world')).toContainText('changed_after_first_clear');

  const proof = {
    schema: 'bec/kelplantis/live-browser-e2e-proof/v1',
    status: consoleErrors.length ? 'FAIL' : 'PASS',
    runtime: 'browser',
    server: 'Supabase RPC',
    player_id: after.player.id,
    player_token_sha256: sha256(PLAYER_TOKEN),
    before_gate: before.gate,
    illegal_floor2_attempt: illegal,
    after_gate: after.gate,
    floor_progress: after.progress,
    world_state: after.world,
    persisted_after_reload: true,
    console_errors: consoleErrors,
    source_commit: process.env.GITHUB_SHA || 'local'
  };
  writeProof(proof);
  if (consoleErrors.length) throw new Error(`Console errors: ${consoleErrors.join(' | ')}`);
});
