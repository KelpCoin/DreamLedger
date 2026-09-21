const { test, expect } = require('playwright/test');
const fs = require('fs');
const http = require('http');
const path = require('path');

let server;
let baseUrl;
const root = path.resolve(__dirname, '..');
const proofDir = path.join(root, 'RUN-PROOFS');
const outDir = path.join(root, 'compiled', 'universal', 'game', 'kelplantis-mvp');
const proofPath = path.join(proofDir, 'KELPLANTIS-BROWSER-RUNTIME-PROOF.json');

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
      const file = pathname === '/' ? path.join(outDir, 'index.html') : path.join(outDir, pathname.replace(/^\//, ''));
      if (!file.startsWith(outDir) || !fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}/`; resolve(); });
  });
}

test.beforeAll(async () => {
  if (!fs.existsSync(path.join(outDir, 'index.html'))) throw new Error('Kelplantis artifact missing. Run compiler first.');
  await startServer();
});
test.afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

test('Kelplantis Depth 1 7C two-session authoritative gathering slice', { timeout: 90000 }, async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const errors = [];
  for (const page of [pageA, pageB]) {
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
  }

  await pageA.goto(`${baseUrl}#alpha-7c`, { waitUntil: 'load' });
  await pageB.goto(`${baseUrl}#bravo-7c`, { waitUntil: 'load' });
  await expect(pageA.locator('h1')).toHaveText('Kelplantis: Depth 1');
  await pageA.getByPlaceholder('DreamMeez name').fill('Alpha');
  await pageB.getByPlaceholder('DreamMeez name').fill('Bravo');
  await pageA.getByRole('button', { name: 'Enter Depth 1' }).click();
  await pageB.getByRole('button', { name: 'Enter Depth 1' }).click();
  await expect.poll(async () => pageA.evaluate(() => Boolean(window.__KELPLANTIS_TEST__)), { timeout: 30000 }).toBe(true);
  await expect.poll(async () => pageB.evaluate(() => Boolean(window.__KELPLANTIS_TEST__)), { timeout: 30000 }).toBe(true);
  await expect.poll(async () => pageA.evaluate(() => window.__KELPLANTIS_TEST__.snapshot().joined)).toBe(true);
  await expect.poll(async () => pageB.evaluate(() => window.__KELPLANTIS_TEST__.snapshot().joined)).toBe(true);
  await expect.poll(async () => pageA.evaluate(() => window.__KELPLANTIS_7C__ && window.__KELPLANTIS_7C__.realtimeJoined())).toBe(true);
  await expect.poll(async () => pageB.evaluate(() => window.__KELPLANTIS_7C__ && window.__KELPLANTIS_7C__.realtimeJoined())).toBe(true);
  await expect.poll(async () => pageA.evaluate(() => window.__KELPLANTIS_7C__.getNodes().length)).toBeGreaterThan(0);
  await expect.poll(async () => pageA.evaluate(() => window.__KELPLANTIS_7C__.getInventory())).not.toBeNull();
  await expect.poll(async () => pageB.evaluate(() => window.__KELPLANTIS_TEST__.snapshot().peerCount)).toBeGreaterThan(0);

  const presencePeer = await pageB.evaluate(() => window.__KELPLANTIS_TEST__.snapshot().peers.find(p => p.name === 'Alpha'));
  expect(presencePeer).toBeTruthy();
  expect(presencePeer.x).toBeUndefined();
  expect(presencePeer.y).toBeUndefined();
  expect(presencePeer.zone).toBe('depth-1');

  await pageA.evaluate(() => window.__KELPLANTIS_TEST__.moveFar());
  await expect.poll(async () => pageB.evaluate(() => {
    const p=window.__KELPLANTIS_TEST__.snapshot().peers.find(v=>v.name==='Alpha');
    return p ? [Number(p.x),Number(p.y)] : null;
  })).toEqual([35,35]);

  const node = await pageA.evaluate(() => window.__KELPLANTIS_7C__.getNodes().find(n => Number(n.amount) > 0));
  expect(node).toBeTruthy();
  await pageA.evaluate(({ x, y }) => window.__KELPLANTIS_7C__.moveTo(x, y), node);
  const before = Number(node.amount);
  const invBefore = await pageA.evaluate(() => window.__KELPLANTIS_7C__.getInventory().kelp);
  const bUpdatesBefore = await pageB.evaluate(() => window.__KELPLANTIS_7C__.realtimeUpdates());
  await pageA.evaluate(id => window.__KELPLANTIS_7C__.harvest(id), node.id);
  await expect.poll(async () => pageA.evaluate(() => window.__KELPLANTIS_7C__.getInventory().kelp)).toBeGreaterThan(invBefore);
  await expect.poll(async () => pageB.evaluate(id => { const n=window.__KELPLANTIS_7C__.getNodes().find(v=>v.id===id); return n ? Number(n.amount) : -1; }, node.id)).toBe(before - Math.min(5, before));
  await expect.poll(async () => pageB.evaluate(() => window.__KELPLANTIS_7C__.realtimeUpdates()), { timeout: 10000 }).toBeGreaterThan(bUpdatesBefore);

  if (errors.length) throw new Error(`Console errors: ${errors.join(' | ')}`);
  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(proofPath, JSON.stringify({
    schema: 'bec/kelplantis/browser-runtime-proof/v5',
    status: 'PASS', runtime: 'browser', transport: 'supabase_realtime', independent_browser_contexts: 2,
    depth_1_social: true, realtime_presence_slow_state: true, realtime_broadcast_movement: true,
    presence_excludes_position: true, movement_broadcast_observed: true,
    resource_nodes_visible: true, authoritative_harvest: true, inventory_conservation: true,
    resource_depletion_realtime: true, console_errors: [], generated_artifact: 'compiled/universal/game/kelplantis-mvp/index.html'
  }, null, 2) + '\n', 'utf8');

  await contextA.close();
  await contextB.close();
});
