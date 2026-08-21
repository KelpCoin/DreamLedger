const { test, expect } = require('playwright/test');
const fs = require('fs');
const http = require('http');
const path = require('path');
let server; let baseUrl;
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'compiled', 'universal', 'game', 'kelplantis-mvp');

test.beforeAll(async () => {
  if (!fs.existsSync(path.join(outDir, 'index.html'))) throw new Error('Kelplantis artifact missing. Run node compiler/kelplantis/KelplantisTargetCompiler.js first.');
  await new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      const file = path.join(outDir, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.replace(/^\//, '')));
      if (!file.startsWith(outDir) || !fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}/`; resolve(); });
  });
});

test.afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

test('Kelplantis commerce-adjacent result layer', async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: 'load' });
  await expect(page.locator('#share-result')).toBeVisible();
  await expect(page.locator('#save-result-proof')).toBeVisible();
  await expect(page.locator('#leaderboard')).toBeVisible();
  const proof = await page.evaluate(async () => window.KELPLANTIS_RESULT.proofForResult({ floor: 1, cleared: true, level: 4, kills: 7, xp: 140, gold: 33, loot_count: 3 }));
  expect(proof.schema).toBe('bec/kelplantis-result-proof/v1');
  expect(proof.sha256).toMatch(/^[0-9a-f]{64}$/);
  const proofAgain = await page.evaluate(async () => window.KELPLANTIS_RESULT.proofForResult({ floor: 1, cleared: true, level: 4, kills: 7, xp: 140, gold: 33, loot_count: 3 }));
  expect(proofAgain.sha256).toBe(proof.sha256);
  const svg = await page.evaluate(p => window.KELPLANTIS_RESULT.buildShareCardSvg(p), proof);
  expect(svg).toContain('KELPLANTIS');
  expect(svg).toContain(proof.sha256.slice(0, 32));
});
