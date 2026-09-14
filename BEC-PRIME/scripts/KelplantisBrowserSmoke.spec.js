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
      if (!file.startsWith(outDir) || !fs.existsSync(file)) {
        res.writeHead(404);
        res.end('not found');
        return;
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

test.beforeAll(async () => {
  if (!fs.existsSync(path.join(outDir, 'index.html'))) throw new Error('Kelplantis artifact missing. Run compiler first.');
  await startServer();
});

test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

test('Kelplantis Depth 1 7A.5 real two-session network slice', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const errors = [];
  for (const page of [pageA, pageB]) {
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
  }

  await pageA.goto(`${baseUrl}#alpha`, { waitUntil: 'load' });
  await pageB.goto(`${baseUrl}#bravo`, { waitUntil: 'load' });
  await expect(pageA.locator('h1')).toHaveText('Kelplantis: Depth 1');
  await expect(pageA.getByRole('button', { name: 'Enter Depth 1' })).toBeVisible();

  await pageA.getByPlaceholder('DreamMeez name').fill('Alpha');
  await pageB.getByPlaceholder('DreamMeez name').fill('Bravo');
  await pageA.getByRole('button', { name: 'Enter Depth 1' }).click();
  await pageB.getByRole('button', { name: 'Enter Depth 1' }).click();

  await expect.poll(async () => pageA.evaluate(() => pageA = undefined)).toBe(undefined).catch(() => {});
  await expect.poll(async () => pageA.evaluate(() => window.__KELPLANTIS_TEST__.snapshot().joined)).toBe(true);
  await expect.poll(async () => pageB.evaluate(() => window.__KELPLANTIS_TEST__.snapshot().joined)).toBe(true);
  await expect.poll(async () => pageA.evaluate(() => window.__KELPLANTIS_TEST__.snapshot().transport)).toBe('supabase');
  await expect.poll(async () => pageB.evaluate(() => window.__KELPLANTIS_TEST__.snapshot().transport)).toBe('supabase');
  await expect.poll(async () => pageA.evaluate(() => window.__KELPLANTIS_TEST__.snapshot().peerCount)).toBe(1);
  await expect.poll(async () => pageB.evaluate(() => window.__KELPLANTIS_TEST__.snapshot().peerCount)).toBe(1);

  const snapA = await pageA.evaluate(() => window.__KELPLANTIS_TEST__.snapshot());
  expect(snapA.inDepth1).toBe(true);
  expect(snapA.atFountain).toBe(true);
  expect(snapA.peers[0].name).toBe('Bravo');

  await pageA.keyboard.down('d');
  await pageA.waitForTimeout(350);
  await pageA.keyboard.up('d');
  const movedA = await pageA.evaluate(() => window.__KELPLANTIS_TEST__.snapshot());
  expect(movedA.moved).toBe(true);
  await expect.poll(async () => pageB.evaluate(() => window.__KELPLANTIS_TEST__.snapshot().peers[0].x)).toBe(movedA.x);

  await pageA.evaluate(() => window.__KELPLANTIS_TEST__.inspectFirstPeer());
  await expect(pageA.locator('#inspect')).not.toHaveClass(/hidden/);
  await expect(pageA.locator('#iName')).toHaveText('Bravo');
  await expect(pageA.locator('#iTitle')).toContainText('Title:');
  await expect(pageA.locator('#iCosmetics')).toContainText('Cosmetics:');
  await expect(pageA.locator('#iSoul')).toContainText('Soul Tome:');

  await pageA.getByPlaceholder('Say something...').fill('Hello Bravo');
  await pageA.getByRole('button', { name: 'Chat' }).click();
  await expect.poll(async () => pageB.evaluate(() => window.__KELPLANTIS_TEST__.snapshot().lastPeerChat)).toBe('Hello Bravo');

  await pageA.getByRole('button', { name: 'Emote' }).click();
  await expect.poll(async () => pageB.evaluate(() => window.__KELPLANTIS_TEST__.snapshot().lastPeerEmote)).toBe('*waves*');

  await pageA.evaluate(() => window.__KELPLANTIS_TEST__.refreshPresence());
  await pageB.waitForTimeout(150);
  await expect.poll(async () => pageB.evaluate(() => window.__KELPLANTIS_TEST__.snapshot().peerCount)).toBe(1);

  await pageA.getByRole('button', { name: 'Save' }).click();
  const saved = await pageA.evaluate(() => window.__KELPLANTIS_TEST__.snapshot());
  await pageA.evaluate(() => window.__KELPLANTIS_TEST__.moveFar());
  await pageA.getByRole('button', { name: 'Save' }).click();
  await pageA.evaluate(() => window.__KELPLANTIS_TEST__.load());
  const loaded = await pageA.evaluate(() => window.__KELPLANTIS_TEST__.snapshot());
  expect(loaded.x).toBe(saved.x);
  expect(loaded.y).toBe(saved.y);
  expect(loaded.name).toBe('Alpha');

  await contextA.close();
  await expect.poll(async () => pageB.evaluate(() => window.__KELPLANTIS_TEST__.snapshot().peerCount)).toBe(0);

  if (errors.length) throw new Error(`Console errors: ${errors.join(' | ')}`);

  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(proofPath, JSON.stringify({
    schema: 'bec/kelplantis/browser-runtime-proof/v3',
    status: 'PASS',
    runtime: 'browser',
    transport: 'supabase_realtime',
    independent_browser_contexts: 2,
    page_loads: true,
    create_avatar: true,
    depth_1_entry: true,
    fountain_spawn: true,
    player_movement: true,
    realtime_presence: true,
    realtime_broadcast_movement: true,
    identity_inspection: true,
    proximity_chat: true,
    emotes: true,
    presence_refresh: true,
    disconnect_cleanup: true,
    save_load: true,
    console_errors: [],
    generated_artifact: 'compiled/universal/game/kelplantis-mvp/index.html'
  }, null, 2) + '\n', 'utf8');

  await contextB.close();
});
