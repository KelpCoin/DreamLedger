'use strict';

// Compiler-owned public surface. The template is the source; compiled/ is disposable output.
// Fail closed on silo contamination or secret/internal material.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'compiled', 'website');
const ASSET = path.join(OUT, 'assets', 'marketplace-live.js');
const INDEX = path.join(OUT, 'index.html');
const TEMPLATE = path.join(ROOT, 'surface', 'index.v2.template.html');
const MANIFEST = path.join(ROOT, 'manifests', 'CUBE-PUBLIC-SURFACE-MANIFEST.json');
const OFFERS = path.join(ROOT, 'catalog', 'offers', 'offers.json');
const IP = path.join(ROOT, 'catalog', 'ip-capabilities.json');
const PRODUCTS = path.join(ROOT, 'catalog', 'products');
const NEWS = path.join(ROOT, 'data', 'silo-news.json');
const AUCTIONS = path.join(ROOT, 'data', 'auctions.json');
const PROOF = path.join(ROOT, 'PROOF-CUBE-SURFACE-COMPILATION.json');
const FORBIDDEN_PUBLIC = ['amplissa','bbw','big beautiful women','adult-only','adult only','stripe_secret_key','stripe_webhook_secret','/var/data/','127.0.0.1','BEC-PRIME','ELOHIM','internal control plane'];

function must(file){if(!fs.existsSync(file))throw new Error(`CUBE surface input missing: ${path.relative(ROOT,file)}`)}
function digest(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}
function json(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value,'utf8')}
function assertClean(label,content){const lower=String(content).toLowerCase();const hit=FORBIDDEN_PUBLIC.find(token=>lower.includes(token.toLowerCase()));if(hit)throw new Error(`PUBLIC_SURFACE_GATE_FAILED: ${label} contains forbidden token: ${hit}`)}

[TEMPLATE,MANIFEST,OFFERS,IP,PRODUCTS,NEWS,AUCTIONS].forEach(must);
fs.mkdirSync(path.join(OUT,'assets'),{recursive:true});
const manifest=json(MANIFEST), offers=json(OFFERS), ip=json(IP), news=json(NEWS), auctions=json(AUCTIONS);
const template=fs.readFileSync(TEMPLATE,'utf8');
const marketplaceRuntime=fs.existsSync(ASSET)?fs.readFileSync(ASSET,'utf8'):'';
assertClean('template',template); if(marketplaceRuntime)assertClean('marketplace runtime',marketplaceRuntime);
write(INDEX,template); assertClean('compiled index',fs.readFileSync(INDEX,'utf8'));
const productCount=fs.readdirSync(PRODUCTS).filter(x=>x.endsWith('.json')).length;
const capabilityCount=Array.isArray(ip)?ip.length:(ip.capabilities||[]).length;
const offerCount=Array.isArray(offers)?offers.length:(offers.offers||[]).length;
const auctionCount=Array.isArray(auctions)?auctions.length:(auctions.auctions||[]).length;
const build={type:'dreamledger-public-surface-compilation',status:'PASS',compiler:'surface',schema:manifest.schema,compiled_at:new Date().toISOString(),source_hashes:{template:digest(TEMPLATE),manifest:digest(MANIFEST),offers:digest(OFFERS),ip:digest(IP),news:digest(NEWS),auctions:digest(AUCTIONS),surface_html:digest(INDEX),marketplace_runtime:fs.existsSync(ASSET)?digest(ASSET):null},counts:{capabilities:capabilityCount,offers:offerCount,products:productCount,news_silos:Object.keys(news).length,auctions:auctionCount},public_surfaces:manifest.public_surfaces,gates:{approval_required_for_activation:manifest.surface_policy.approval_required_for_activation===true,private_material_excluded:manifest.surface_policy.private_material_excluded===true,silo_isolation_required:manifest.surface_policy.silo_isolation_required===true,forbidden_public_tokens_checked:true,template_compiled:true}};
write(PROOF,JSON.stringify(build,null,2)+'\n');
console.log(JSON.stringify(build,null,2));
