#!/usr/bin/env node
'use strict';

// Generate an isolated, empty silo shell from the MTG master.
// This only writes to an explicit staging directory outside the repository.
// It never publishes routes, copies inventory, or creates/activates Stripe links.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MASTER_MANIFEST = 'silos/mtg/silo.json';
const PUBLIC_MASTER_MANIFEST = 'public/silos/mtg/silo.json';
const REGISTRY_PATH = 'ops/catalog/silos/registry.json';
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function htmlEscape(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}
function assertValidSlug(slug) {
  if (typeof slug !== 'string' || slug.length < 2 || slug.length > 63 || !SLUG_RE.test(slug)) {
    throw new Error('SLUG_INVALID');
  }
}
function normalizeInputs({ slug, title, short, tagline, accent, currency }, registry) {
  assertValidSlug(slug);
  if (slug === 'mtg') throw new Error('MASTER_SLUG_CANNOT_BE_CLONED_OVER');
  if (registry.silos.some(silo => silo.slug === slug)) throw new Error('SILO_SLUG_ALREADY_REGISTERED:' + slug);
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) throw new Error('TITLE_REQUIRED_OR_TOO_LONG');
  const safeShort = (short || title).trim();
  if (safeShort.length > 40) throw new Error('SHORT_LABEL_TOO_LONG');
  const safeTagline = (tagline || 'Clear listings. Explicit evidence. No invented inventory.').trim();
  if (!safeTagline || safeTagline.length > 180) throw new Error('TAGLINE_INVALID');
  const safeAccent = accent || '#5277a8';
  if (!COLOR_RE.test(safeAccent)) throw new Error('ACCENT_MUST_BE_HEX_COLOR');
  const safeCurrency = (currency || 'USD').toUpperCase();
  if (!CURRENCY_RE.test(safeCurrency)) throw new Error('CURRENCY_INVALID');
  return {
    slug, title: title.trim(), short: safeShort, tagline: safeTagline,
    accent: safeAccent, currency: safeCurrency
  };
}
export function buildSiloPlan(options, { repoRoot = REPO_ROOT } = {}) {
  const masterPath = path.join(repoRoot, MASTER_MANIFEST);
  const publicMasterPath = path.join(repoRoot, PUBLIC_MASTER_MANIFEST);
  const registryPath = path.join(repoRoot, REGISTRY_PATH);
  const gateTemplatePath = path.join(repoRoot, 'ops/catalog/templates/silo-manifest.v1.json');
  const master = readJson(masterPath);
  const publicMaster = readJson(publicMasterPath);
  const registry = readJson(registryPath);
  const gateTemplate = readJson(gateTemplatePath);

  if (master.schema !== 'BEC-PRIME/CUBE-CLONE-MANIFEST/v1' ||
      publicMaster.schema !== master.schema ||
      publicMaster.slug !== 'mtg' || master.slug !== 'mtg' ||
      gateTemplate.schema_version !== 'dreamledger/silo-manifest/v1') {
    throw new Error('MTG_MASTER_SCHEMA_OR_GATE_TEMPLATE_INVALID');
  }
  if (master.status === 'production' || master.status === 'live' ||
      master.inventory_policy !== 'empty_until_verified_supply' ||
      master.payment_truth !== 'settled_payment_only' ||
      !master.isolation || Object.values(master.isolation).some(value => value !== true) ||
      JSON.stringify(master.capabilities_by_ref) !== JSON.stringify(publicMaster.capabilities_by_ref) ||
      JSON.stringify(master.isolation) !== JSON.stringify(publicMaster.isolation) ||
      publicMaster.inventory_policy !== 'empty_until_verified_supply' ||
      publicMaster.payment_truth !== 'settled_payment_only') {
    throw new Error('MTG_MASTER_BASELINE_NOT_SAFE_TO_CLONE');
  }
  // This is a deliberate two-contract boundary:
  // CUBE manifest drives the public shell; dreamledger/silo-manifest/v1 gates
  // candidate ingestion and product readiness. Neither contract substitutes for the other.
  if (registry.schema_version !== 'dreamledger/silo-registry/v1' || !Array.isArray(registry.silos)) {
    throw new Error('SILO_REGISTRY_INVALID');
  }
  const mtgEntry = registry.silos.find(s => s.slug === 'mtg');
  if (!mtgEntry || mtgEntry.clone_master_ref !== MASTER_MANIFEST ||
      mtgEntry.clone_manifest_schema !== master.schema ||
      mtgEntry.catalog_gate_manifest_schema !== 'dreamledger/silo-manifest/v1' ||
      mtgEntry.live_checkout_enabled !== false || mtgEntry.lifecycle !== 'INGEST_ONLY') {
    throw new Error('MTG_MASTER_NOT_REGISTERED_FAIL_CLOSED');
  }
  if (registry.default_live_checkout_enabled !== false || registry.invented_products_allowed !== false) {
    throw new Error('REGISTRY_GLOBAL_DEFAULTS_NOT_FAIL_CLOSED');
  }

  const input = normalizeInputs(options, registry);
  const manifest = structuredClone(master);
  manifest.slug = input.slug;
  manifest.name = input.title;
  manifest.short = input.short;
  manifest.tagline = input.tagline;
  manifest.accent = input.accent;
  manifest.accent_bright = input.accent;
  manifest.route = '/' + input.slug + '/';
  manifest.list_route = '/' + input.slug + '-list';
  manifest.catalog = '/data/' + input.slug + '-catalog.json';
  manifest.manifest_path = '/silos/' + input.slug + '/silo.json';
  manifest.neutral_host = 'dreamledger';
  // Never inherit the source's live_candidate lifecycle, even though the source
  // itself is not a production-grade baseline. Every clone begins quarantined.
  manifest.status = 'ingest_only';
  manifest.live_checkout_enabled = false;
  delete manifest.listing_template_ref;
  delete manifest.success_fee_peer;
  delete manifest.account_to_sell;
  manifest.currency = input.currency;
  manifest.inventory_policy = 'empty_until_verified_supply';
  manifest.payment_truth = 'settled_payment_only';
  manifest.product_kinds = [{ id: 'offer', label: 'Offer', primary: true }];
  manifest.listing_fields_required = ['title', 'description', 'price', 'currency'];
  manifest.listing_fields_optional = ['images', 'delivery_terms', 'lead_time'];
  manifest.clone = {
    ...manifest.clone,
    rule: 'Clone shell and capability bindings only. Never copy inventory, identities, promotion state, or credentials.',
    source_master_ref: MASTER_MANIFEST,
    catalog_gate_manifest_ref: 'ops/catalog/templates/silo-manifest.v1.json',
    stage_only: true,
    do_not_copy: [
      'product inventory rows', 'customer data', 'stripe credentials',
      'analytics identities', 'other silo promotion', 'payment links', 'secrets'
    ]
  };
  manifest.surface = {
    hero_pills: ['Browse listings', 'Evidence-led', 'Checkout disabled'],
    primary_cta: { label: 'Browse listings', href: '#catalog' },
    secondary_cta: null,
    community_blocks: []
  };

  const catalog = {
    schema: 'dreamledger/silo-catalogue/v1',
    silo: input.slug,
    currency: input.currency,
    products: []
  };
  const gateManifest = structuredClone(gateTemplate);
  gateManifest.slug = input.slug;
  gateManifest.title = input.title;
  gateManifest.description = input.tagline;
  gateManifest.lifecycle = 'INGEST_ONLY';
  gateManifest.source_policy.invented_products_allowed = false;
  gateManifest.elohim_refinement.enabled = true;
  gateManifest.elohim_refinement.suggestions_are_non_mutating = true;
  gateManifest.elohim_refinement.changes_require_new_gauntlet_run = true;
  gateManifest.commerce.live_checkout_enabled = false;
  gateManifest.commerce.requires_human_commercial_approval = true;
  gateManifest.commerce.fulfillment_contract_required = true;
  gateManifest.commerce.default_checkout_state = 'HOLD';

  const registryEntry = {
    slug: input.slug,
    title: input.title,
    description: input.tagline,
    lifecycle: 'INGEST_ONLY',
    live_checkout_enabled: false,
    clone_master_ref: MASTER_MANIFEST,
    public_manifest_ref: 'public/silos/' + input.slug + '/silo.json',
    clone_manifest_schema: master.schema,
    catalog_gate_manifest_ref: 'ops/catalog/silos/manifests/' + input.slug + '.json',
    catalog_gate_manifest_schema: gateManifest.schema_version
  };
  const clonedRegistry = structuredClone(registry);
  clonedRegistry.silos.push(registryEntry);
  const indexHtml = createIndexHtml(input);
  return {
    schema: 'dreamledger/silo-clone-plan/v1',
    source_master_ref: MASTER_MANIFEST,
    source_public_manifest_ref: PUBLIC_MASTER_MANIFEST,
    candidate_silo: input.slug,
    lifecycle: 'INGEST_ONLY',
    live_checkout_enabled: false,
    inventory_copied: false,
    customer_data_copied: false,
    credentials_copied: false,
    payment_links_created: false,
    public_routes_published: false,
    files: {
      manifest: { path: 'public/silos/' + input.slug + '/silo.json', content: manifest },
      catalog: { path: 'public/data/' + input.slug + '-catalog.json', content: catalog },
      index: { path: 'public/' + input.slug + '/index.html', content: indexHtml },
      catalogGateManifest: { path: 'ops/catalog/silos/manifests/' + input.slug + '.json', content: gateManifest },
      registry: { path: REGISTRY_PATH, content: clonedRegistry }
    }
  };
}
function createIndexHtml(input) {
  const title = htmlEscape(input.title);
  const short = htmlEscape(input.short);
  const tagline = htmlEscape(input.tagline);
  const slug = input.slug; // validated slug only
  const catalogPath = '/data/' + slug + '-catalog.json';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${title} · DreamLedger</title>
<meta name="description" content="${tagline}">
<link rel="stylesheet" href="/assets/silo-master.css">
<style>:root{--silo-accent:${input.accent};--silo-accent-bright:${input.accent};}.clone-notice{padding:1rem;border:1px solid var(--silo-line);border-radius:12px;color:var(--silo-muted)}</style>
</head>
<body class="silo-body" data-silo="${slug}">
<header class="silo-hdr"><div class="silo-hdr-inner"><a class="silo-logo" href="/${slug}/">Dream<em>Ledger</em> · ${short}</a></div></header>
<main class="silo-wrap">
<section class="hero"><p class="silo-eyebrow">${short}</p><h1 class="silo-display">${title}</h1><p class="silo-lead">${tagline}</p>
<p class="clone-notice">This silo is a staged shell. Listings are empty until supply and evidence pass the review gates. Checkout is disabled.</p></section>
<section class="silo-section" id="catalog"><h2 class="silo-h2">Listings</h2><p id="status" role="status">Loading catalogue…</p><div id="grid" class="grid"></div></section>
</main>
<script>
fetch('${catalogPath}',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Catalogue unavailable');return r.json()}).then(data=>{
 const products=Array.isArray(data.products)?data.products:[];
 const status=document.getElementById('status');
 const grid=document.getElementById('grid');
 if(!products.length){status.textContent='No listings available. Inventory has not been populated.';return;}
 status.textContent=products.length+' listing(s)';
 for(const product of products){
  const card=document.createElement('article');card.className='deck';
  const heading=document.createElement('h3');heading.textContent=String(product.name||product.title||'Untitled listing');
  const body=document.createElement('p');body.textContent=String(product.description||'');
  card.append(heading,body);grid.append(card);
 }
}).catch(()=>{document.getElementById('status').textContent='Catalogue unavailable.';});
</script>
</body>
</html>
`;
}
export function stageSiloClone(options, { stageDir, repoRoot = REPO_ROOT } = {}) {
  if (typeof stageDir !== 'string' || !path.isAbsolute(stageDir)) {
    throw new Error('ABSOLUTE_EXTERNAL_STAGE_DIR_REQUIRED');
  }
  const resolvedStage = path.resolve(stageDir);
  const resolvedRepo = path.resolve(repoRoot);
  const relative = path.relative(resolvedRepo, resolvedStage);
  if (relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('STAGE_DIRECTORY_MUST_BE_OUTSIDE_REPOSITORY');
  }
  if (fs.existsSync(resolvedStage) && fs.readdirSync(resolvedStage).length > 0) {
    throw new Error('STAGE_DIRECTORY_MUST_BE_EMPTY');
  }
  const plan = buildSiloPlan(options, { repoRoot });
  const destinations = Object.values(plan.files).map(file => path.join(resolvedStage, file.path));
  for (const destination of destinations) {
    if (fs.existsSync(destination)) throw new Error('CLONE_OUTPUT_ALREADY_EXISTS:' + destination);
  }
  for (const file of Object.values(plan.files)) {
    const destination = path.join(resolvedStage, file.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const content = typeof file.content === 'string' ? file.content : JSON.stringify(file.content, null, 2) + '\n';
    fs.writeFileSync(destination, content, { flag: 'wx' });
  }
  return {
    ...plan,
    stage_dir: resolvedStage,
    files: Object.fromEntries(Object.entries(plan.files).map(([key, file]) => [
      key, { path: file.path, absolute_path: path.join(resolvedStage, file.path) }
    ]))
  };
}
function readArgs(argv) {
  const args = {};
  let stageDir = null;
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (item === '--slug' && argv[i+1]) args.slug = argv[++i];
    else if (item === '--title' && argv[i+1]) args.title = argv[++i];
    else if (item === '--short' && argv[i+1]) args.short = argv[++i];
    else if (item === '--tagline' && argv[i+1]) args.tagline = argv[++i];
    else if (item === '--accent' && argv[i+1]) args.accent = argv[++i];
    else if (item === '--currency' && argv[i+1]) args.currency = argv[++i];
    else if (item === '--stage' && argv[i+1]) stageDir = argv[++i];
    else if (item === '--help') args.help = true;
    else throw new Error('UNKNOWN_OR_INCOMPLETE_ARGUMENT:' + item);
  }
  return { args, stageDir };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { args, stageDir } = readArgs(process.argv.slice(2));
    if (args.help || !args.slug || !args.title) {
      console.log('Usage: node ops/catalog/silo-clone-factory.mjs --slug <slug> --title <title> [--short <label>] [--tagline <text>] [--accent #RRGGBB] [--currency USD] [--stage <absolute-empty-dir>]');
      process.exitCode = args.help ? 0 : 2;
    } else if (!stageDir) {
      const plan = buildSiloPlan(args);
      console.log(JSON.stringify({ status: 'PLAN_ONLY', ...plan, files: Object.fromEntries(Object.entries(plan.files).map(([key, file]) => [key, {path:file.path}])) }, null, 2));
    } else {
      console.log(JSON.stringify({ status: 'STAGED_NOT_PUBLISHED', ...stageSiloClone(args, { stageDir }) }, null, 2));
    }
  } catch (error) {
    console.error(JSON.stringify({ status: 'HOLD', error: String(error.message || error) }, null, 2));
    process.exitCode = 1;
  }
}
