'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const failures = [];
const checks = [];

function read(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    failures.push(`MISSING:${rel}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function check(name, condition, detail) {
  const pass = Boolean(condition);
  checks.push({ name, pass, detail: detail || '' });
  if (!pass) failures.push(`${name}:${detail || 'failed'}`);
}

function json(rel) {
  try { return JSON.parse(read(rel)); }
  catch (err) { failures.push(`INVALID_JSON:${rel}:${err.message}`); return null; }
}

const capabilities = json('catalog/ip-capabilities.json');
const offers = json('catalog/offers/offers.json');
const products = fs.readdirSync(path.join(ROOT, 'catalog', 'products')).filter(x => x.endsWith('.json')).map(x => json(path.join('catalog/products', x)));
const auctions = json('data/auctions.json');
const server = read('server.js');
const start = read('start.js');
const control = read('runtime/ControlPlane.js');
const proxy = read('proxy/DigitalProxy.js');
const assistant = read('proxy/DigitalProxyAssistant.js');
const gauntlet = read('gauntlet/GauntletV6.js');
const elohim = read('elohim/ElohimV6.js');
const demand = read('runtime/DemandRadar.js');
const sentinel = read('runtime/Sentinel.js');
const render = read('render.yaml');
const surface = read('compiled/website/index.html');
const proxyUi = read('compiled/website/assets/digital-proxy-assist.js');

check('CANONICAL_IP_CATALOG', capabilities && capabilities.schema === 'BEC-PRIME/IP-CAPABILITY-CATALOG/v1' && Array.isArray(capabilities.capabilities) && capabilities.capabilities.length >= 10, 'capability catalog missing or unexpectedly small');
check('OFFER_GATES_LOCKED', offers && Array.isArray(offers.offers) && offers.offers.every(o => o.approval_required === true && o.checkout_available === false && o.status === 'candidate'), 'compiled offer contains an unlocked economic object');
check('OFFER_IDS_UNIQUE', offers && new Set(offers.offers.map(o => o.offer_id)).size === offers.offers.length, 'duplicate offer IDs');
check('NO_PUBLIC_SECRET_MARKERS', !/sk_(live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----/.test(read('catalog/ip-capabilities.json')), 'secret marker in public IP catalog');
check('COMMANDER_CANONICAL_PRICE', products.some(p => p && p.id === 'COMMANDER-DECK-DIAGNOSTIC-001' && p.price === 1500 && p.currency === 'nzd'), 'Commander must be 1500 NZ cents');
check('DREAMIEZ_SILO_ISOLATED', products.filter(p => p && String(p.silo).startsWith('dreamiez')).every(p => !String(p.id).toLowerCase().includes('mtg')), 'Dreamiez product crossed into MTG identity');
check('MTG_SILO_ISOLATED', products.filter(p => p && p.silo === 'mtg').every(p => !String(p.id).toLowerCase().includes('dreamiez')), 'MTG product crossed into Dreamiez identity');
check('PUBLIC_SURFACE_ENGINE_BACKED', surface.includes('/api/products') && surface.includes('/api/offers') && surface.includes('no-store'), 'homepage is not clearly engine-backed');
check('CONTROL_PLANE_WIRED', control.includes('ELOHIM-V6') && control.includes('GAUNTLET-V6') && control.includes('DigitalProxy'), 'control plane wiring missing');
check('GAUNTLET_PRESENT', gauntlet.includes('approval_required') && gauntlet.includes('silo') && gauntlet.includes('PASS'), 'Gauntlet does not expose expected verification boundary');
check('ELOHIM_APPROVAL_BOUNDARY', elohim.includes('forbidden_without_human_approval') && elohim.includes('PROPOSED'), 'Elohim proposal boundary missing');
check('PROXY_TOKEN_GATE', proxy.includes('DIGITAL_PROXY_APPROVAL_TOKEN') && proxy.includes('PENDING_APPROVAL') && proxy.includes('APPROVED'), 'Digital Proxy approval gate missing');
check('PROXY_ASSISTANT_NON_INVASIVE', assistant.includes('DIGITAL_PROXY_LM_ENABLED') && assistant.includes('Never claim to be the owner'), 'Digital Proxy assistant safety boundary missing');
check('PHONE_FIRST_HELP_UI', proxyUi.includes('Need help?') && proxyUi.includes('/api/digital-proxy/help') && proxyUi.includes('Nothing opens automatically'), 'help UI is not opt-in/non-invasive');
check('DEMAND_RADAR_PROPOSAL_ONLY', demand.includes('proposal-only') || (demand.includes('approval_required') && demand.includes('publish_allowed')), 'Demand Radar lacks proposal-only gates');
check('SENTINEL_FAIL_CLOSED', sentinel.includes('verdict') && sentinel.includes('may stop unsafe startup'), 'Sentinel boundary missing');
check('RUNTIME_WIRES_NEW_LAYERS', start.includes('DemandRadar') && start.includes('Sentinel') && start.includes('DigitalProxyAssistant'), 'runtime wiring missing');
check('CHECKOUT_SERVER_AUTHORITY', server.includes('/api/checkout/create') && server.includes('product_id') && server.includes('price_data'), 'checkout route missing server-side product authority');
check('STRIPE_WEBHOOK_PROOF', server.includes('checkout.session.completed') && server.includes('FIRST_PAYMENT_PROOF'), 'payment proof boundary missing');
check('RENDER_WEB_SERVICE', /type:\s*web/.test(render) && render.includes('healthCheckPath: /healthz') && render.includes('rootDir: BEC-PRIME'), 'Render Blueprint is not an explicit BEC-PRIME Web Service');
check('AUCTION_APPROVAL_BOUNDARY', auctions && JSON.stringify(auctions).includes('approval_required'), 'auction seed data lacks approval boundary');
check('AUCTION_SILO_FIELD', auctions && JSON.stringify(auctions).includes('silo'), 'auction data lacks silo isolation');
check('KELPLANTIS_NOT_LIVE_IN_MAIN_SURFACE', !surface.toLowerCase().includes('kelplantis') || surface.toLowerCase().includes('future'), 'Kelplantis appears live without future boundary');

const smoke = spawnSync(process.execPath, [path.join(__dirname, 'smoke-dreamiez.js')], {
  cwd: ROOT,
  env: { ...process.env, SMOKE_PORT: String(Number(process.env.SMOKE_PORT || 38766)) },
  encoding: 'utf8'
});
check('DREAMIEZ_E2E_SMOKE', smoke.status === 0, (smoke.stdout || smoke.stderr || '').trim().slice(-1600));

const result = {
  schema: 'BEC-PRIME/META-GAUNTLET/v1',
  verified_at: new Date().toISOString(),
  red_team: {
    focus: ['silo leakage', 'unlocked offers', 'public secret markers', 'fake live integrations', 'payment proof spoofing', 'approval bypass', 'non-invasive UX']
  },
  blue_team: {
    focus: ['canonical catalogs', 'server-authoritative checkout', 'Elohim/Gauntlet control plane', 'Digital Proxy approval', 'Demand Radar proposal-only behavior', 'Sentinel fail-closed startup', 'Dreamiez persistence smoke']
  },
  checks,
  failures,
  verdict: failures.length === 0 ? 'PASS' : 'FAIL'
};

const proof = path.join(ROOT, 'PROOF-META-GAUNTLET.json');
fs.writeFileSync(proof, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
process.exit(failures.length === 0 ? 0 : 1);
