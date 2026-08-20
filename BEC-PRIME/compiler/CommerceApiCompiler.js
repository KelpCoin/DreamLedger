'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PRODUCTS_DIR = path.join(ROOT, 'catalog', 'products');
const OUT = path.join(ROOT, 'compiled', 'website', 'api');
const DATA = path.join(OUT, '_catalog.json');
const PROOF = path.join(ROOT, 'PROOF-COMMERCE-API-COMPILATION.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, 'utf8');
}

function compile() {
  if (!fs.existsSync(PRODUCTS_DIR)) throw new Error('Commerce product catalog missing');

  const products = fs.readdirSync(PRODUCTS_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readJson(path.join(PRODUCTS_DIR, name)));

  const payload = {
    schema: 'BEC-PRIME/LIVE-COMMERCE-CATALOG/v1',
    generated_at: new Date().toISOString(),
    source: 'BEC-PRIME/catalog/products/*.json',
    product_count: products.length,
    products
  };

  fs.mkdirSync(OUT, { recursive: true });
  write(DATA, JSON.stringify(payload, null, 2) + '\n');

  const common = "'use strict';\nconst fs = require('fs');\nconst path = require('path');\nconst DATA = path.join(__dirname, '_catalog.json');\nfunction load(){ return JSON.parse(fs.readFileSync(DATA, 'utf8')); }\nfunction send(res,status,body){ res.statusCode=status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store'); res.end(JSON.stringify(body)); }\n";

  write(path.join(OUT, 'catalog.js'), common + "module.exports = function catalog(req,res){ if(req.method !== 'GET'){ return send(res,405,{error:'Method not allowed'}); } const data=load(); return send(res,200,data); };\n");

  write(path.join(OUT, 'products.js'), common + "module.exports = function products(req,res){ if(req.method !== 'GET'){ return send(res,405,{error:'Method not allowed'}); } const data=load(); return send(res,200,{schema:data.schema,product_count:data.product_count,products:data.products}); };\n");

  write(path.join(OUT, 'products', '[id].js'), common + "module.exports = function product(req,res){ if(req.method !== 'GET'){ return send(res,405,{error:'Method not allowed'}); } const id=decodeURIComponent(String(req.query && req.query.id || '').trim()); const data=load(); const product=data.products.find((item)=>String(item.id)===id); if(!product) return send(res,404,{error:'Product not found',id:id}); return send(res,200,product); };\n");

  const proof = {
    type: 'dreamledger-commerce-api-compilation-proof',
    status: 'PASS',
    product_count: products.length,
    source_hash: sha256(JSON.stringify(products)),
    generated_files: [
      'compiled/website/api/_catalog.json',
      'compiled/website/api/catalog.js',
      'compiled/website/api/products.js',
      'compiled/website/api/products/[id].js'
    ],
    contract: {
      catalog: '/api/catalog',
      products: '/api/products',
      product: '/api/products/:id'
    }
  };

  write(PROOF, JSON.stringify(proof, null, 2) + '\n');
  return proof;
}

if (require.main === module) console.log(JSON.stringify(compile(), null, 2));
module.exports = { compile };
