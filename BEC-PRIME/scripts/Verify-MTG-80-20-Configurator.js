'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const configFile = path.join(ROOT, 'catalog', 'configurator', 'EDH_0001.json');
const productFile = path.join(ROOT, 'catalog', 'products', 'EDH_0001.json');
const routeFile = path.join(ROOT, 'routes', 'mtgConfigurator.js');
const pageFile = path.join(ROOT, 'compiled', 'website', 'mtg', 'configurator.html');
const proofFile = path.join(ROOT, 'data', 'proofs', 'MTG-80-20-CONFIGURATOR-SOURCE-PROOF.json');

const failures = [];
function exists(file, label) { if (!fs.existsSync(file)) failures.push(label + ':MISSING'); return fs.existsSync(file); }
function read(file, label) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) { failures.push(label + ':INVALID_JSON'); return null; } }

const config = exists(configFile, 'CONFIG') ? read(configFile, 'CONFIG') : null;
const product = exists(productFile, 'PRODUCT') ? read(productFile, 'PRODUCT') : null;
exists(routeFile, 'ROUTE');
exists(pageFile, 'PAGE');

if (config && product) {
  if (config.deck_id !== 'EDH_0001') failures.push('CONFIG:DECK_ID');
  if (config.base_price_minor !== product.price) failures.push('CONFIG:PRICE_MISMATCH');
  if (product.status !== 'published') failures.push('PRODUCT:NOT_PUBLISHED');
  if (Number(product.inventory || 0) < 1) failures.push('PRODUCT:NO_INVENTORY');
  if (config.currency !== 'NZD') failures.push('CONFIG:CURRENCY');
  if (config.status !== 'LIVE_CONFIGURABLE') failures.push('CONFIG:NOT_LIVE_CONFIGURABLE');
  if (!config.customization || !Array.isArray(config.customization.land_packages)) failures.push('CONFIG:LAND_PACKAGES');
  if (!config.customization || !Array.isArray(config.customization.flex_slots)) failures.push('CONFIG:FLEX_SLOTS');
  if (!config.customization || !Array.isArray(config.customization.premium_upgrades)) failures.push('CONFIG:PREMIUM_UPGRADES');
  for (const item of config.customization.land_packages || []) {
    if (item.status === 'AVAILABLE' && !item.inventory_ref) failures.push('LAND:' + item.id + ':NO_INVENTORY_REF');
  }
  const availableNonDefault = (config.customization.land_packages || []).filter(x => x.status === 'AVAILABLE' && x.id !== config.defaults.land_package);
  if (availableNonDefault.length > 0) failures.push('CONFIG:UNVERIFIED_CUSTOM_LAND_IS_AVAILABLE');
  for (const slot of config.customization.flex_slots || []) {
    for (const option of slot.options || []) {
      if (option.status === 'AVAILABLE' && !option.inventory_ref) failures.push('FLEX:' + option.id + ':NO_INVENTORY_REF');
    }
  }
  for (const item of config.customization.premium_upgrades || []) {
    if (item.status === 'AVAILABLE' && !item.inventory_ref) failures.push('UPGRADE:' + item.id + ':NO_INVENTORY_REF');
  }
}

const result = {
  schema_version: 'mtg-80-20-source-proof-v1',
  timestamp_utc: new Date().toISOString(),
  status: failures.length ? 'FAIL' : 'PASS',
  scope: 'SOURCE_ONLY_NOT_LIVE_DEPLOYMENT_PROOF',
  deck_id: 'EDH_0001',
  checks: {
    configurator_registry_present: fs.existsSync(configFile),
    product_registry_present: fs.existsSync(productFile),
    route_present: fs.existsSync(routeFile),
    compiled_page_present: fs.existsSync(pageFile),
    base_price_matches_product: !!(config && product && config.base_price_minor === product.price),
    base_product_published: !!(product && product.status === 'published'),
    base_inventory_positive: !!(product && Number(product.inventory || 0) > 0),
    unverified_custom_inventory_fail_closed: !!(config && (config.customization.land_packages || []).filter(x => x.status === 'AVAILABLE' && x.id !== config.defaults.land_package).length === 0)
  },
  failures,
  revenue_nzd: 0,
  first_payment: 'NOT_PROVEN'
};

fs.mkdirSync(path.dirname(proofFile), { recursive: true });
fs.writeFileSync(proofFile, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(result, null, 2));
process.exit(failures.length ? 1 : 0);
