const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'data', 'products.json');

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const now = Date.now();
let changed = false;

for (const p of data.products || []) {
  if (p.type !== 'Auction' || !p.auctionEnd) continue;
  if (p.approved !== true || p.sold === true) continue;
  if (Date.parse(p.auctionEnd) <= now) {
    p.status = 'ENDED';
    changed = true;
  }
}

if (changed) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, changed, checked_at: new Date().toISOString() }));
