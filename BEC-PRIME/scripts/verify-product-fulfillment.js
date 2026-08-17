'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PRODUCT_DIR = path.join(ROOT, 'catalog', 'products');
const REGISTRY_FILE = path.join(ROOT, 'fulfillment', 'PRODUCT-FULFILLMENT-REGISTRY.json');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function verify() {
  const registry = readJson(REGISTRY_FILE);
  const products = fs.readdirSync(PRODUCT_DIR).filter(x => x.endsWith('.json')).sort();
  const failures = [];
  const results = [];

  for (const file of products) {
    const product = readJson(path.join(PRODUCT_DIR, file));
    const entry = registry.entries[product.id];
    const published = product.status === 'published';
    const inventoryPositive = Number(product.inventory || 0) > 0;
    const ready = !!(entry && entry.ready === true);
    const templateReady = !entry || entry.type !== 'report_template' || fs.existsSync(path.join(ROOT, '..', entry.template));
    const physicalReady = !entry || entry.type !== 'physical_inventory' || inventoryPositive;
    const serviceReady = !entry || entry.type !== 'service_activation' || !!entry.delivery_target;
    const pass = !published || (ready && templateReady && physicalReady && serviceReady);

    if (!pass) {
      failures.push({ id: product.id, reason: !entry ? 'NO_FULFILLMENT_CONTRACT' : 'FULFILLMENT_NOT_READY' });
    }

    results.push({ id: product.id, published, inventory: Number(product.inventory || 0), fulfillment_ready: ready && templateReady && physicalReady && serviceReady });
  }

  const output = {
    schema: 'BEC-PRIME/PRODUCT-FULFILLMENT-VERIFICATION/v1',
    status: failures.length === 0 ? 'PASS' : 'QUARANTINE_PUBLISHED_PRODUCTS',
    product_count: products.length,
    failures,
    results
  };

  console.log(JSON.stringify(output, null, 2));
  if (failures.length > 0) process.exitCode = 1;
  return output;
}

if (require.main === module) verify();
module.exports = { verify };
