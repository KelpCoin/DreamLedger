'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const catalog = require('../catalog/AutoRevenueCatalog');

const ROOT = path.join(__dirname, '..');
const PRODUCT_DIR = path.join(ROOT, 'catalog', 'products');
const APPROVED = path.join(ROOT, 'catalog', 'offers', 'approved.json');
const PROOF = path.join(ROOT, 'Proof', 'AUTO-100-REVENUE-CATALOG.json');

const generated = catalog.ensure();
const ids = [];
for (let i = 1; i <= 100; i += 1) {
  const id = `DL-AUTO-${String(i).padStart(3, '0')}`;
  const file = path.join(PRODUCT_DIR, `${id}.json`);
  if (!fs.existsSync(file)) throw new Error(`Missing generated product: ${id}`);
  const product = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (product.status !== 'published' || product.commercial_truth?.approval_required !== false || Number(product.inventory) < 1) throw new Error(`Product is not publicly eligible: ${id}`);
  ids.push(id);
}
const approved = JSON.parse(fs.readFileSync(APPROVED, 'utf8')).approved || [];
const approvedIds = new Set(approved.map(x => x.offer_id));
for (const id of ids) if (!approvedIds.has(id)) throw new Error(`Missing explicit approval: ${id}`);
const payload = { schema: 'BEC-AUTO-100-REVENUE/v1', status: 'PASS', generated_count: generated.count, product_count: ids.length, approved_count: approved.length, first: ids[0], last: ids[ids.length - 1], source_sha256: crypto.createHash('sha256').update(ids.join('\n')).digest('hex'), checked_at_utc: new Date().toISOString() };
fs.mkdirSync(path.dirname(PROOF), { recursive: true });
fs.writeFileSync(PROOF, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(payload, null, 2));
