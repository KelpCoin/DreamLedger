'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'public/catalog.json',
  'public/data/mtg-catalog.json',
  'data/mtg-catalog.json',
  'catalog/products/EDH_0001.json',
  'BEC-PRIME/catalog/products/EDH_0001.json',
  'BEC-PRIME/catalog/configurator/EDH_0001.json',
  'BEC-PRIME/compiled/website/data/mtg-catalog.json',
];

function parsePrice(argv) {
  const arg = argv.find((value) => value.startsWith('--price-nzd='));
  if (!arg) throw new Error('Pass the owner-approved price explicitly with --price-nzd=<integer>.');
  const price = Number(arg.slice('--price-nzd='.length));
  if (!Number.isSafeInteger(price) || price <= 0) throw new Error('Price must be a positive integer NZD amount.');
  return price;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(ROOT, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function productIn(document, relativePath) {
  if (relativePath.endsWith('EDH_0001.json')) return document;
  const product = document.products?.find((item) => item.id === 'EDH_0001');
  if (!product) throw new Error(`EDH_0001 missing from ${relativePath}`);
  return product;
}

function reconcile(priceNzd) {
  for (const relativePath of FILES) {
    const document = readJson(relativePath);
    const product = productIn(document, relativePath);
    if (relativePath.endsWith('configurator/EDH_0001.json')) {
      document.base_price_minor = priceNzd * 100;
      document.status = 'HELD';
      document.inventory_status = 'NO_VERIFIED_AVAILABLE_STOCK';
    } else if (relativePath.endsWith('BEC-PRIME/catalog/products/EDH_0001.json')) {
      document.price = priceNzd * 100;
      document.currency = 'nzd';
      document.inventory = 0;
      document.status = 'held';
      document.checkout.enabled = false;
      document.commercial_truth.approval_required = true;
      document.commercial_truth.sellable = false;
      document.commercial_truth.payment_link = null;
      document.commercial_truth.payment_link_id = null;
    } else if (relativePath.endsWith('catalog/products/EDH_0001.json')) {
      document.price = priceNzd * 100;
      document.currency = 'nzd';
      document.inventory = 0;
      document.status = 'held';
      document.commercial_truth.approval_required = true;
      document.commercial_truth.checkout_available = false;
      document.commercial_truth.payment_link = null;
      delete document.metadata.patron_price_nzd;
      delete document.metadata.patron_url;
    } else {
      product.price = priceNzd;
      product.currency = relativePath === 'public/catalog.json' ? 'nzd' : 'NZD';
      product.status = 'held';
      product.inventory = 0;
      product.checkout_available = false;
      if ('checkout_url' in product) product.checkout_url = null;
      if ('claim_url' in product) product.claim_url = null;
      if ('sale_mode' in product) product.sale_mode = 'request_confirmation';
      if (relativePath === 'public/catalog.json') {
        product.availability = 'review_required';
        delete product.patron_price_nzd;
        delete product.patron_url;
      }
    }

    writeJson(relativePath, document);
  }
}

if (require.main === module) reconcile(parsePrice(process.argv.slice(2)));

module.exports = { FILES, parsePrice, readJson, productIn, reconcile };
