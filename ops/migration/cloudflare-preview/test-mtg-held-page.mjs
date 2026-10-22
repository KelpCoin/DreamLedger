import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

for (const path of ['public/mtg/index.html', 'mtg/index.html']) {
  const html = readFileSync(path, 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  test(`${path}: complete executable script`, () => {
    assert.equal(scripts.length, 1);
    new vm.Script(scripts[0][1]);
    assert.equal((html.match(/<script\b/gi) || []).length, scripts.length);
  });
  for (const scenario of ['empty', 'published-without-proof', 'offline', 'invalid']) {
    test(`${path}: ${scenario} never invents inventory`, async () => {
      const status = { textContent: '', classList: { add() {} } };
      const grid = { innerHTML: 'stale stock', replaceChildren() { this.innerHTML = ''; } };
      const context = {
        document: { getElementById: id => id === 'status' ? status : grid },
        fetch: async () => {
          if (scenario === 'offline') throw Error('offline');
          return { ok: true, json: async () => scenario === 'invalid' ? {} : {
            products: scenario === 'published-without-proof' ? [{status:'published',inventory:1,price:90}] : []
          }};
        }
      };
      await vm.runInNewContext(scripts[0][1], context);
      assert.equal(grid.innerHTML, '');
      assert.match(status.textContent, /unavailable/);
      assert.doesNotMatch(status.textContent, /NZ\$|in stock/);
    });
  }
}
