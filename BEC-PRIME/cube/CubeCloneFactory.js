'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '../..');
const MASTER_PATH = path.join(REPO_ROOT, 'silos', 'mtg', 'silo.json');
const REGISTRY_PATH = path.join(REPO_ROOT, 'BEC-PRIME', 'catalog', 'silos', 'CUBE-SILO-REGISTRY.json');
const OUT_ROOT = path.join(REPO_ROOT, 'BEC-PRIME', 'data', 'cube-clones', 'candidates');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    out[key] = argv[i + 1];
    i++;
  }
  return out;
}
function buildCandidate(master, slug, name, shortName, accent) {
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(slug) || slug === 'mtg') {
    throw new Error('slug must be 2-40 lowercase letters, digits, or hyphens and cannot be mtg');
  }
  if (!String(name || '').trim()) throw new Error('name is required');
  if (accent && !/^#[0-9a-f]{6}$/i.test(accent)) throw new Error('accent must be a six-digit hex colour');

  const manifest = JSON.parse(JSON.stringify(master));
  manifest.slug = slug;
  manifest.name = String(name).trim();
  manifest.short = String(shortName || name).trim().slice(0, 24);
  manifest.tagline = 'A new DreamLedger silo candidate. Listings remain empty until supply is verified.';
  manifest.route = '/' + slug + '/';
  manifest.list_route = '/' + slug + '/list';
  manifest.catalog = '/data/' + slug + '-catalog.json';
  manifest.manifest_path = '/silos/' + slug + '/silo.json';
  manifest.status = 'candidate';
  manifest.template_role = 'candidate';
  manifest.clone_fossil_status = 'NOT_RUN';
  if (accent) {
    manifest.accent = accent;
    manifest.accent_bright = accent;
  }

  manifest.product_kinds = [];
  manifest.listing_template_ref = null;
  manifest.listing_fields_required = [];
  manifest.listing_fields_optional = [];
  manifest.surface = {
    hero_pills: [],
    primary_cta: { label: 'Create a listing', href_key: 'list_route' },
    secondary_cta: { label: 'Browse listings', href: '#catalog' },
    community_blocks: []
  };
  manifest.clone = {
    ...manifest.clone,
    source_of_truth: 'silos/mtg/silo.json',
    master_schema: 'BEC-PRIME/CUBE-CLONE-MANIFEST/v1',
    catalog_default: 'empty',
    inventory_copy: false,
    customer_data_copy: false,
    credential_copy: false,
    checkout_default: 'disabled',
    release_requires_clean_clone_fossil: true
  };
  for (const key of Object.keys(manifest.isolation || {})) manifest.isolation[key] = true;

  const catalog = {
    schema: 'BEC-PRIME/SILO-CATALOG/v1',
    silo: slug,
    status: 'empty_until_verified_supply',
    products: []
  };
  const proof = {
    schema: 'BEC-PRIME/CUBE-CLONE-CANDIDATE/v1',
    status: 'CANDIDATE_GENERATED',
    source_manifest: 'silos/mtg/silo.json',
    source_manifest_sha256: sha256(JSON.stringify(master)),
    candidate_slug: slug,
    candidate_manifest_sha256: sha256(JSON.stringify(manifest)),
    catalog_sha256: sha256(JSON.stringify(catalog)),
    assertions: {
      source_resolved_through_registry: true,
      inventory_copied: false,
      customer_data_copied: false,
      credentials_copied: false,
      route_isolated: manifest.route !== master.route,
      catalog_empty: catalog.products.length === 0,
      checkout_disabled: manifest.clone.checkout_default === 'disabled',
      gauntlet_and_human_approval_required: manifest.clone.activation_requires.includes('gauntlet_pass') && manifest.clone.activation_requires.includes('human_publish_approval')
    },
    release_status: 'HOLD',
    next_gate: 'Run the clean-clone contract and independent Gauntlet; do not publish or activate checkout.'
  };
  return { manifest, catalog, proof };
}
function writeCandidate(target, candidate) {
  const manifestPath = path.join(target, 'silos', candidate.manifest.slug, 'silo.json');
  const catalogPath = path.join(target, 'data', candidate.manifest.slug + '-catalog.json');
  const proofPath = path.join(target, 'proofs', 'candidate-proof.json');
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
  fs.mkdirSync(path.dirname(proofPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(candidate.manifest, null, 2) + '\n');
  fs.writeFileSync(catalogPath, JSON.stringify(candidate.catalog, null, 2) + '\n');
  fs.writeFileSync(proofPath, JSON.stringify(candidate.proof, null, 2) + '\n');
  return { manifestPath, catalogPath, proofPath };
}

function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const slug = String(args.slug || '').trim().toLowerCase();
  const name = String(args.name || '').trim();
  const shortName = String(args.short || name).trim();
  const accent = String(args.accent || '').trim();
  const registry = readJson(REGISTRY_PATH);
  const masterEntry = registry.master_template;
  if (!masterEntry || masterEntry.id !== 'mtg' || masterEntry.manifest_path !== 'silos/mtg/silo.json') {
    throw new Error('Canonical MTG master cannot be resolved through CUBE-SILO-REGISTRY.json');
  }
  if (!['candidate_reference', 'verified_reference'].includes(masterEntry.template_role)) {
    throw new Error('MTG master registry role is not eligible for candidate generation');
  }
  const master = readJson(path.join(REPO_ROOT, masterEntry.manifest_path));
  if (master.schema !== masterEntry.manifest_schema) throw new Error('Master manifest schema does not match registry');
  const candidate = buildCandidate(master, slug, name, shortName, accent);
  const target = path.join(OUT_ROOT, slug);
  if (fs.existsSync(target)) throw new Error('Candidate already exists; refusing to overwrite: ' + target);
  fs.mkdirSync(target, { recursive: true });
  const written = writeCandidate(target, candidate);
  console.log(JSON.stringify({ ...candidate.proof, output: path.relative(REPO_ROOT, target), files: Object.fromEntries(Object.entries(written).map(([key, value]) => [key, path.relative(REPO_ROOT, value)])), public_activation: 'NOT_PERFORMED' }, null, 2));
  return candidate;
}

if (require.main === module) {
  try { run(); } catch (error) { console.error('CUBE_CLONE_FACTORY=HOLD'); console.error(error.message); process.exitCode = 1; }
}
module.exports = { buildCandidate, writeCandidate, run };
