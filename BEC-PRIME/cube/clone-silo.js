'use strict';
// CUBE v2: deterministic offline candidate compiler; NEVER activates a public shop.
const fs = require('node:fs');
const path = require('node:path');

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_CURRENCY = /^[A-Z]{3}$/;
const FORBIDDEN = /(?:^|[_-])(?:secret|password|passwd|token|credential|customer|buyer|payment[_-]?intent|api[_-]?key|private[_-]?key|auth[_-]?header|webhook[_-]?secret|inventory[_-]?records)(?:$|[_-])/i;
const SECRET_VALUE = /(?:sk_live_|sk_test_|rk_live_|rk_test_|whsec_|-----BEGIN [A-Z ]*PRIVATE KEY-----|Bearer\s+[A-Za-z0-9_.-]{12,})/i;
const INVENTORY_MODES = new Set(['physical','digital','service','mixed']);
const PAYMENT_PROVIDERS = new Set(['stripe','external','none']);
function must(condition, message) {
  if (!condition) throw new Error('CUBE_CLONE_REJECTED: ' + message);
}
function simpleText(value, max, key) {
  must(typeof value === 'string' && value.trim() && value.length <= max, key);
  return value.trim();
}
function rejectSecrets(obj, depth=0) {
  must(depth <= 20, 'excessive input nesting');
  if (typeof obj === 'string') {
    must(obj.length <= 4096 && !SECRET_VALUE.test(obj), 'credential-like input string');
    return;
  }
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    must(obj.length <= 500, 'array too large');
    obj.forEach(value => rejectSecrets(value, depth+1));
    return;
  }
  must(Object.keys(obj).length <= 500, 'object too large');
  for (const [key, value] of Object.entries(obj)) {
    must(!FORBIDDEN.test(key), 'forbidden input: ' + key);
    rejectSecrets(value, depth+1);
  }
}
function compileSilo(config) {
  must(config && typeof config === 'object' && !Array.isArray(config), 'config object required');
  rejectSecrets(config);
  const slug = simpleText(config.slug, 48, 'slug');
  must(SLUG.test(slug) && slug.length >= 2, 'slug invalid');
  const name = simpleText(config.display_name, 120, 'display_name');
  const locale = simpleText(config.locale, 32, 'locale');
  const jurisdiction = simpleText(config.jurisdiction, 64, 'jurisdiction');
  const currency = simpleText(config.currency, 3, 'currency');
  must(ISO_CURRENCY.test(currency), 'currency must use ISO-4217 format');
  must(INVENTORY_MODES.has(config.inventory_mode), 'inventory_mode unsupported');
  must(PAYMENT_PROVIDERS.has(config.payment_provider), 'payment_provider unsupported');
  const brand = config.brand;
  must(brand && typeof brand === 'object' && !Array.isArray(brand), 'brand required');
  const brand_name = simpleText(brand.name, 120, 'brand.name');
  const accent = simpleText(brand.accent, 7, 'brand.accent');
  must(/^#[a-fA-F0-9]{6}$/.test(accent), 'brand.accent not hex');
  const domain_fields = config.domain_fields;
  must(Array.isArray(domain_fields) && domain_fields.length <= 40, 'domain_fields required');
  const seen = new Set();
  for (const field of domain_fields) {
    must(typeof field === 'string' && /^[a-z][a-z0-9_]{1,47}$/.test(field), 'domain field invalid');
    must(!seen.has(field), 'duplicate domain field');
    seen.add(field);
  }
  const fee = config.peer_fee_basis_points == null ? 0 : config.peer_fee_basis_points;
  must(Number.isInteger(fee) && fee >= 0 && fee <= 10000, 'peer fee out of range');
  const legal = config.legal_pack;
  must(legal && typeof legal === 'object' && !Array.isArray(legal), 'legal_pack required');
  const policies = Array.isArray(legal.required_policy_types) ? legal.required_policy_types : [];
  must(policies.length > 0 && policies.length <= 30, 'legal policy types required');
  policies.forEach(x => simpleText(x, 64, 'legal.required_policy_types'));
  const seed = config.seed_candidates || [];
  must(Array.isArray(seed) && seed.length <= 500, 'seed_candidates invalid');
  const seed_seen = new Set();
  const seedReview = seed.map(item => {
    must(item && typeof item === 'object' && !Array.isArray(item), 'seed item invalid');
    const sku = simpleText(item.sku, 128, 'seed sku');
    must(/^[A-Za-z0-9_-]{2,128}$/.test(sku) && !seed_seen.has(sku), 'duplicate/invalid seed sku');
    seed_seen.add(sku);
    const title = simpleText(item.title, 240, 'seed title');
    must(Number.isSafeInteger(item.price_minor) && item.price_minor >= 0, 'seed price_minor invalid');
    must(item.attributes && typeof item.attributes === 'object' && !Array.isArray(item.attributes), 'seed attributes required');
    Object.keys(item.attributes).forEach(key => must(seen.has(key), 'undeclared domain field'));
    // A seed is only a private review candidate. It is never considered stock.
    return {sku,title,price_minor:item.price_minor,currency,attributes:item.attributes,
      status:'pending_review',quantity_available:0,checkout_available:false,
      supply_attestation_verified:false};
  });
  const manifest = {
    schema:'CUBE/SILO/v2', slug, display_name:name, currency, locale, jurisdiction,
    brand:{name:brand_name,accent:accent.toLowerCase()},
    inventory_mode:config.inventory_mode,payment_provider:config.payment_provider,
    peer_fee_basis_points:fee, domain_fields:domain_fields.slice(),
    legal_pack:{jurisdiction,required_policy_types:policies.slice(),
      status:'requires_independent_jurisdiction_review'},
    route:'/'+slug+'/', listing_route:'/'+slug+'/list',
    state:'draft', public_approved:false,legal_review_approved:false,
    checkout_enabled:false, community_enabled:false,
    inventory_authority:'marketplace.supply_attestations',
    payment_authority:'verified_provider_settlement',
    no_inventory_clone:true
  };
  const catalogue = {
    schema:'CUBE/CATALOGUE/v2',silo_id:slug,currency,
    status:'empty_until_independently_attested',
    products:[], checkout_enabled:false
  };
  const health = {
    schema:'CUBE/SILO-READINESS/v1',silo_id:slug,status:'HOLD_NOT_READY',
    metrics:{verified_stock_listings:0,pending_listing_reviews:seedReview.length,
      verified_paid_orders:null,fulfillments_verified:null,active_community_participants:null},
    gates:{jurisdiction_policy_review:false,public_publication_approval:false,
      verified_supply:false,checkout_contract:false,settlement_evidence:false,
      fulfillment_acceptance:false,community_moderation:false,silo_boundary_test:false},
    revenue_claim:'UNVERIFIED',clone_is_production:false
  };
  return {manifest,catalogue,health,seedReview:{
    schema:'CUBE/SEED-REVIEW/v1',silo_id:slug,public:false,candidates:seedReview
  }};
}
function main(args) {
  must(args.length === 2, 'usage: node clone-silo.js config.json output_dir');
  const config = JSON.parse(fs.readFileSync(args[0], 'utf8'));
  const compiled = compileSilo(config);
  const dir = path.resolve(args[1]);
  const repo = path.resolve(__dirname,'..','..');
  const within = (parent, child) => {
    const rel=path.relative(parent,child);
    return rel==='' || (rel!=='..' && !rel.startsWith('..'+path.sep) && !path.isAbsolute(rel));
  };
  const publicDir=path.join(repo,'public'),gitDir=path.join(repo,'.git');
  must(!within(publicDir,dir) && !within(gitDir,dir), 'refuse automatic public writes');
  let ancestor=dir;
  while(!fs.existsSync(ancestor)){
    const next=path.dirname(ancestor);
    must(next!==ancestor, 'no existing output ancestor');
    ancestor=next;
  }
  const actual=fs.realpathSync(ancestor);
  must(!within(publicDir,actual) && !within(gitDir,actual),'refuse symlink public writes');
  fs.mkdirSync(dir,{recursive:true});
  for (const [key,file] of Object.entries({manifest:'silo.json',
     catalogue:'catalogue.json',health:'health-contract.json',seedReview:'seed-review.json'}))
    fs.writeFileSync(path.join(dir,file),JSON.stringify(compiled[key],null,2)+'\n',{flag:'wx'});
  process.stdout.write(JSON.stringify({slug:compiled.manifest.slug,
    state:'DRAFT_HOLD',written:4,checkout_enabled:false})+'\n');
}
if (require.main === module) main(process.argv.slice(2));
module.exports={compileSilo};
