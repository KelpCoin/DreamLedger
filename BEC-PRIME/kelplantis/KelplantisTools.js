'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PRODUCTS = path.join(ROOT, 'catalog', 'products');
const CAPABILITIES = path.join(ROOT, 'catalog', 'ip-capabilities.json');

const definitions = [
  {
    type: 'function',
    function: {
      name: 'read_public_catalog',
      description: 'Read the public DreamLedger product catalog. Never returns secrets or credentials.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_capability_catalog',
      description: 'Read the DreamLedger IP capability catalog metadata for analysis. Never returns credentials or private material.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  }
];

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

async function execute(name) {
  if (name === 'read_public_catalog') {
    if (!fs.existsSync(PRODUCTS)) return { products: [] };
    const products = fs.readdirSync(PRODUCTS).filter(file => file.endsWith('.json')).sort().map(file => readJson(path.join(PRODUCTS, file))).map(product => ({
      id: product.id,
      silo: product.silo,
      name: product.name,
      description: product.description,
      price: product.price,
      currency: product.currency,
      status: product.status,
      inventory: product.inventory
    }));
    return { products };
  }
  if (name === 'read_capability_catalog') {
    const catalog = readJson(CAPABILITIES);
    return { capabilities: (catalog.capabilities || []).map(capability => ({
      id: capability.id,
      name: capability.name,
      category: capability.category,
      summary: capability.summary,
      commercialization: capability.commercialization,
      silo: capability.silo,
      pricing_strategy: capability.pricing_strategy,
      tiers: capability.tiers || []
    })) };
  }
  throw new Error(`Tool not allowlisted: ${name}`);
}

module.exports = { definitions, execute };
