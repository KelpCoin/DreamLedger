const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'catalog', 'compiled-offers.json');
const productDir = path.join(root, 'catalog', 'products');
const products = fs.readdirSync(productDir).filter(x => x.endsWith('.json')).map(x => JSON.parse(fs.readFileSync(path.join(productDir, x), 'utf8')));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ generated_utc: new Date().toISOString(), products }, null, 2) + '\n');
console.log(`Compiled ${products.length} offers to ${out}`);
