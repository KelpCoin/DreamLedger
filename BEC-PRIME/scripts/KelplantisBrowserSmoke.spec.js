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

test('Kelplantis Depth 1 social vertical slice', async ({ browser }) => {
  const context = await browser.newContext();
  const pageA = await context.newPage();
  const pageB = await context.newPage();
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

  await expect.poll(async () => pageA.evaluate(() => window.__KELPLANTIS_TEST__.snapshot().peerCount)).toBe(1);
  await expect.poll(async () => pageB.evaluate(() => window.__KELPLANTIS_TEST__.snapshot().peerCount)).toBe(1);

  const snapA = await pageA.evaluate(() => window.__KELPLANTIS_TEST__.snapshot());
  expect(snapA.inDepth1).toBe(true);
  expect(snapA.atFountain).toBe(true);
  expect(snapA.peers[0].name).toBe('Bravo');

  await pageA.keyboard.down('d');
  await pageA.waitForTimeout(350);
  await pageA.keyboard.up('d');
  const moved = await pageA.evaluate(() => window.__KELPLANTIS_TEST__.snapshot());
  expect(moved.moved).toBe(true);

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

  await pageA.getByRole('button', { name: 'Save' }).click();
  const saved = await pageA.evaluate(() => window.__KELPLANTIS_TEST__.snapshot());
  await pageA.evaluate(() => window.__KELPLANTIS_TEST__.moveFar());
  await pageA.getByRole('button', { name: 'Save' }).click();
  await pageA.evaluate(() => window.__KELPLANTIS_TEST__.load());
  const loaded = await pageA.evaluate(() => window.__KELPLANTIS_TEST__.snapshot());
  expect(loaded.x).toBe(saved.x);
  expect(loaded.y).toBe(saved.y);
  expect(loaded.name).toBe('Alpha');

  await pageA.keyboard.press('e');
  await pageA.waitForTimeout(50);
  expect((await pageA.evaluate(() => window.__KELPLANTIS_TEST__.snapshot()).catch(() => null))).not.toBeNull();

  if (errors.length) throw new Error(`Console errors: ${errors.join(' | ')}`);

  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(proofPath, JSON.stringify({
    schema: 'bec/kelplantis/browser-runtime-proof/v2',
    status: 'PASS',
    runtime: 'browser',
    page_loads: true,
    create_avatar: true,
    depth_1_entry: true,
    fountain_spawn: true,
    player_movement: true,
    two_client_presence: true,
    identity_inspection: true,
    proximity_chat: true,
    emotes: true,
    save_load: true,
    console_errors: [],
    generated_artifact: 'compiled/universal/game/kelplantis-mvp/index.html'
  }, null, 2) + '\n', 'utf8');

  await context.close();
});
