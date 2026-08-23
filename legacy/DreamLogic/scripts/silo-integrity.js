const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
let pass = true;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
  pass = pass && ok;
}
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

const mtg = read('mtg.html');
const index = read('index.html');
const revenue = read('revenue.html');
const marketplace = read('marketplace.html');
const dreamiez = read('dreamiez/index.html');
const server = read('server.js');
const productsDir = path.join(root, 'catalog', 'products');
const products = fs.existsSync(productsDir)
  ? fs.readdirSync(productsDir).filter(x => x.endsWith('.json')).map(x => JSON.parse(read(path.join('catalog', 'products', x))))
  : [];

check('MTG page uses canonical offers API', mtg.includes("fetch('/api/offers')"));
check('MTG page hard-filters MTG silo', /toUpperCase\(\)==='MTG'/.test(mtg));
check('MTG page uses current product checkout', mtg.includes("fetch('/api/checkout/create'") && mtg.includes('product_id'));
check('MTG page contains no Dreamiez surface', !/Dreamiez|Cosmetic Pouch|Brush Roll|Cosmic Hoodie/i.test(mtg));
check('MTG page contains no B2B marketplace surface', !/marketplace|B2B|seller intake|listing approval/i.test(mtg));
check('MTG route serves dedicated mtg.html', server.includes("'/mtg': 'mtg.html'"));
check('Server catalogMtgOffers filters MTG', server.includes("String(x.silo || '').toUpperCase() === 'MTG'"));
check('Server marketplace filters B2B', server.includes("String(x.silo || '').toUpperCase() === 'B2B'"));
check('Catalog contains no non-MTG record masquerading as MTG', products.filter(p => String(p.silo || '').toUpperCase() === 'MTG').every(p => !/Dreamiez|B2B|Kelplantis|adult|cosmetic/i.test(JSON.stringify(p))));
check('All catalog records declare a silo', products.every(p => typeof p.silo === 'string' && p.silo.trim().length > 0));
check('MTG checkout requires an offer id server-side', server.includes("const id = String(req.body?.offer_id || '')"));

check('Neutral front door names independent silos', ['Dreamiez','Kelplantis','MTG','BEC-PRIME'].every(x => index.includes(x)));
check('Neutral front door has no stale empty-approval claim', !index.includes('approval registry is empty'));
check('Revenue surface reads canonical offers API', revenue.includes("fetch('/api/offers'") && revenue.includes('canonical offers API'));
check('Revenue surface does not claim approval registry is empty', !revenue.includes('approval registry is currently empty'));
check('Revenue surface does not imply payment from checkout state', revenue.includes('not payment evidence'));
check('B2B marketplace labels its silo', marketplace.includes('B2B MARKETPLACE') && marketplace.includes("/api/marketplace/catalog"));
check('B2B marketplace contains no MTG checkout path', !marketplace.includes('/api/offer-checkout/create') && !marketplace.includes('COMMANDER-DECK-DIAGNOSTIC-001'));
check('B2B marketplace uses its own intake route', marketplace.includes('/api/marketplace/intake'));
check('Dreamiez surface contains no Stripe checkout', !dreamiez.includes('stripe') && !dreamiez.includes('/api/offer-checkout/create'));
check('Dreamiez surface contains no MTG catalog references', !/COMMANDER-DECK|MTG|offer-checkout/i.test(dreamiez));
check('Dreamiez surface has no B2B intake route', !dreamiez.includes('/api/marketplace/intake'));

process.exitCode = pass ? 0 : 1;
console.log(pass ? 'SILO INTEGRITY PASS' : 'SILO INTEGRITY FAIL');
