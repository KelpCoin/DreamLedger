'use strict';
const route = require('./EDHOneLinkRoute');

function response() {
  return { writableEnded: false, writeHead(status) { this.status = status; }, end(body) { this.body = body; this.writableEnded = true; } };
}
async function request(payload) {
  const res = response();
  const req = { method: 'POST', headers: {}, async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(payload)); } };
  await route.handle(req, res, '/api/mtg/import');
  return res;
}
async function main() {
  const missing = await request({});
  if (missing.status !== 422) throw new Error('SOURCE_URL_REQUIRED gate failed');
  const insecure = await request({ source_url: 'http://manabox.app/decks/x' });
  if (insecure.status !== 422) throw new Error('HTTPS gate failed');
  const unsupported = await request({ source_url: 'https://example.com/decks/x' });
  if (unsupported.status !== 422) throw new Error('host allowlist gate failed');
  const tooMany = await request({ source_url: 'https://manabox.app/decks/x', comparison_product_ids: ['1','2','3','4','5','6'] });
  if (tooMany.status !== 422) throw new Error('five-comparison gate failed');
  console.log('EDH_ONE_LINK_CONTRACT: PASS');
}
main().catch(error => { console.error(error.stack || error.message); process.exit(1); });
