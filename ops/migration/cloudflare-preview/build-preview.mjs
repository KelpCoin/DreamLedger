#!/usr/bin/env node
/**
 * Creates a non-production Cloudflare Pages preview bundle.
 * This copies public content while excluding Node server/webhook handlers,
 * package metadata, preloads and internal work files. Dynamic commerce routes
 * are handled by the fail-closed _worker.js scaffold until ported and tested.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const source = path.join(repoRoot, 'public');
const output = path.join(here, 'dist');
const workerSource = path.join(here, '_worker.js');
const extAllow = new Set([
  '.html','.css','.js','.json','.xml','.txt','.svg','.webmanifest',
  '.png','.jpg','.jpeg','.webp','.gif','.ico','.woff','.woff2','.ttf','.otf','.pdf','.mp4','.webm'
]);
const excludedNames = new Set([
  'server.js','paidCheckoutWebhook.js','Sync-BECPrimeStorefront.js',
  'patch-dreammeez-brand.js','package.json','package-lock.json',
  'README.md','PUBLIC_MONETIZATION.md','WORKLOG-2026-09-27.md',
  'PRODUCTION-DEPLOY-TRIGGER-2026-09-27.txt'
]);
const excludedSuffixes = ['.test.js','.spec.js','.ps1','.sh','.mjs'];
const manifest = { schema:'dreamledger/cloudflare-preview-build/v1', created_at:new Date().toISOString(), included:[], excluded:[] };

function shouldExclude(rel, name) {
  if (rel.split(path.sep).some(part => part.startsWith('.'))) return true;
  if (excludedNames.has(name)) return true;
  if (excludedSuffixes.some(s => name.toLowerCase().endsWith(s))) return true;
  if (/^(?:.*Preload\.js|.*\.env(?:\..*)?)$/i.test(name)) return true;
  if (!extAllow.has(path.extname(name).toLowerCase())) return true;
  return false;
}
async function walk(dir, rel = '') {
  for (const entry of await fs.readdir(dir, { withFileTypes:true })) {
    const abs = path.join(dir, entry.name);
    const childRel = path.join(rel, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        manifest.excluded.push({ path:childRel, reason:'hidden_or_dependency_directory' });
        continue;
      }
      await walk(abs, childRel);
      continue;
    }
    if (!entry.isFile()) continue;
    if (shouldExclude(childRel, entry.name)) {
      manifest.excluded.push({ path:childRel, reason:'extension_or_sensitive_filename_policy' });
      continue;
    }
    const target = path.join(output, childRel);
    await fs.mkdir(path.dirname(target), { recursive:true });
    await fs.copyFile(abs, target);
    const bytes = await fs.readFile(abs);
    manifest.included.push({
      path:childRel.split(path.sep).join('/'),
      bytes:bytes.length,
      sha256:crypto.createHash('sha256').update(bytes).digest('hex')
    });
  }
}
await fs.rm(output, { recursive:true, force:true });
await fs.mkdir(output, { recursive:true });
await walk(source);
await fs.copyFile(workerSource, path.join(output, '_worker.js'));

// Validate all published catalogue projections before any preview upload.
const publicCataloguePath = path.join(output, 'catalog.json');
const mtgCataloguePath = path.join(output, 'data', 'mtg-catalog.json');
const pulsePath = path.join(output, 'data', 'economic-pulse.json');
const readJson = async p => JSON.parse(await fs.readFile(p, 'utf8'));
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const publicCatalogue = await readJson(publicCataloguePath);
const mtgCatalogue = await readJson(mtgCataloguePath);
// Fail closed: no MTG listing is marketable without a verified upstream supply atom.
 // This preview has no live independent supply verifier, so a published listing is never admitted.
 // Do not replace this check with a self-declared 'verified' flag; verify the actual evidence
 // and its origin before enabling the published state in a future reviewed release.
const mtgIds = new Set((mtgCatalogue.products || []).map(p => p.id));
for (const [sourceName, records] of [['mtg',mtgCatalogue.products],['public',publicCatalogue.products]]) {
  if (!Array.isArray(records)) throw new Error('INVALID_CATALOGUE_PRODUCTS: ' + sourceName);
  for (const product of records) {
    if (!product || typeof product !== 'object') throw new Error('INVALID_CATALOGUE_PRODUCT: ' + sourceName);
    if (!(sourceName === 'mtg' || mtgIds.has(product.id) || product.silo === 'mtg')) continue;
    if (product.status === 'published') throw new Error('MTG_PUBLISHED_WITHOUT_INDEPENDENT_SUPPLY_VERIFIER: ' + product.id);
    if (product.status === 'held' && (
      own(product, 'price') || own(product, 'patreon_price') ||
      own(product, 'claim_url') || own(product, 'checkout_url') ||
      own(product, 'payment_link_url') || product.checkout_available === true
    )) throw new Error('HELD_MTG_HAS_PRICE_OR_CLAIM: ' + product.id);
  }
}
for (const [doc, id, label] of [
  [publicCatalogue, 'EDH_0001', 'public EDH_0001'],
  [mtgCatalogue, 'EDH_0001', 'MTG EDH_0001'],
  [publicCatalogue, 'COMMANDER-DECK-DIAGNOSTIC-001', 'public Commander Diagnostic'],
  [mtgCatalogue, 'COMMANDER-DECK-DIAGNOSTIC-001', 'MTG Commander Diagnostic']
]) {
  const product = (doc.products || []).find(p => p.id === id);
  if (!product) throw new Error('CATALOGUE_PRODUCT_MISSING: ' + label);
  if (product.status === 'published') throw new Error('UNSAFE_HELD_PRODUCT_PUBLISHED: ' + label);
  if (typeof product.price === 'number' || own(product, 'checkout_url') || own(product, 'payment_link_url')) {
    throw new Error('UNSAFE_HELD_PRODUCT_PRICE_OR_CHECKOUT: ' + label);
  }
  if (product.price_status !== 'UNOBSERVABLE' || product.price_evidence_status !== 'UNVERIFIED') {
    throw new Error('MISSING_UNOBSERVABLE_PRICE_STATE: ' + label);
  }
}
if (await fs.stat(pulsePath).catch(() => null)) {
  const pulse = await readJson(pulsePath);
  const blobs = JSON.stringify(pulse);
  if (blobs.includes('eVqeVdc1T01n1DV3gwdwc30') ||
      (pulse.commercial_surfaces || []).some(x => x.id === 'OFFER-CMD-DIAG-29-NZD') ||
      (pulse.cells || []).some(x => x.id === 'CMD-DIAG-29-QR-001')) {
    throw new Error('HELD_DIAGNOSTIC_LEAKED_IN_ECONOMIC_PULSE');
  }
}
const staleLink = 'https://buy.stripe.com/eVqeVdc1T01n1DV3gwdwc30';
for (const item of manifest.included) {
  const contents = await fs.readFile(path.join(output, item.path), 'utf8').catch(() => '');
  if (contents.includes(staleLink)) throw new Error('HELD_DIAGNOSTIC_PAYMENT_URL_IN_PREVIEW_ASSET: ' + item.path);
}
const missingPage = path.join(output, '404.html');
if (!(await fs.stat(missingPage).catch(() => null))?.isFile()) {
  throw new Error('ROOT_404_REQUIRED: missing public/404.html; Pages would enable its default SPA fallback.');
}
const worker = await fs.readFile(workerSource);
manifest.included.push({ path:'_worker.js', bytes:worker.length, sha256:crypto.createHash('sha256').update(worker).digest('hex') });
await fs.writeFile(path.join(here, 'build-proof.json'), JSON.stringify({
  ...manifest,
  status:'PREVIEW_BUNDLE_BUILT_NOT_PRODUCTION_READY',
  root_404_present:true,
  unknown_paths:'MUST_RETURN_404_NOT_ROOT_SPA_FALLBACK',
  static_only:false,
  dynamic_routes:'EXPLICITLY_BLOCKED_UNTIL_PORTED',
  production_mutation:false,
  dns_changed:false,
  revenue_claimed_nzd:0
}, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  status:'PREVIEW_BUNDLE_BUILT_NOT_PRODUCTION_READY',
  output_dir:path.relative(repoRoot, output).split(path.sep).join('/'),
  included_files:manifest.included.length,
  excluded_files:manifest.excluded.length,
  proof:path.relative(repoRoot, path.join(here,'build-proof.json')).split(path.sep).join('/'),
  dynamic_routes:'BLOCKED_UNTIL_PORTED',
  production_mutation:false
}, null, 2));
