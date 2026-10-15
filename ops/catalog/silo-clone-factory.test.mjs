import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSiloPlan, stageSiloClone } from './silo-clone-factory.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function emptyStage() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-silo-clone-'));
}

test('MTG master generates an isolated, empty and checkout-disabled shell', () => {
  const plan = buildSiloPlan({
    slug: 'music-media-lab',
    title: 'Music and Media',
    short: 'Media',
    tagline: 'A clean shell for evidence-backed creative offers.',
    accent: '#345678',
    currency: 'USD'
  });
  assert.equal(plan.schema, 'dreamledger/silo-clone-plan/v1');
  assert.equal(plan.source_master_ref, 'silos/mtg/silo.json');
  assert.equal(plan.lifecycle, 'INGEST_ONLY');
  assert.equal(plan.live_checkout_enabled, false);
  assert.equal(plan.inventory_copied, false);
  assert.equal(plan.customer_data_copied, false);
  assert.equal(plan.credentials_copied, false);
  assert.equal(plan.payment_links_created, false);
  assert.equal(plan.public_routes_published, false);

  const manifest = plan.files.manifest.content;
  const catalog = plan.files.catalog.content;
  assert.equal(manifest.schema, 'BEC-PRIME/CUBE-CLONE-MANIFEST/v1');
  assert.equal(manifest.slug, 'music-media-lab');
  assert.equal(manifest.route, '/music-media-lab/');
  assert.equal(manifest.list_route, '/music-media-lab-list');
  assert.equal(manifest.catalog, '/data/music-media-lab-catalog.json');
  assert.equal(manifest.manifest_path, '/silos/music-media-lab/silo.json');
  assert.equal(manifest.status, 'ingest_only');
  assert.equal(manifest.live_checkout_enabled, false);
  assert.equal(manifest.inventory_policy, 'empty_until_verified_supply');
  assert.deepEqual(manifest.product_kinds, [{ id: 'offer', label: 'Offer', primary: true }]);
  assert.deepEqual(manifest.isolation, {
    catalog: true, checkout: true, analytics: true,
    customer_data: true, content: true, promotion: true
  });
  assert.equal(catalog.schema, 'dreamledger/silo-catalogue/v1');
  assert.equal(catalog.silo, 'music-media-lab');
  assert.equal(catalog.currency, 'USD');
  assert.deepEqual(catalog.products, []);
  assert.equal(plan.files.index.path, 'public/music-media-lab/index.html');
  assert.match(plan.files.index.content, /noindex,nofollow/);
  assert.match(plan.files.index.content, /Checkout is disabled/);
  assert.doesNotMatch(plan.files.index.content, /Diagnostic NZ\$29|Commander|Buy now|Checkout now/);
});

test('stages exactly three files outside the repository, without publishing', () => {
  const stageDir = emptyStage();
  const result = stageSiloClone({
    slug: 'procurement-lab',
    title: 'Procurement Lab',
    currency: 'USD'
  }, { stageDir });

  const manifestPath = path.join(stageDir, 'public/silos/procurement-lab/silo.json');
  const catalogPath = path.join(stageDir, 'public/data/procurement-lab-catalog.json');
  const indexPath = path.join(stageDir, 'public/procurement-lab/index.html');
  assert.equal(fs.existsSync(manifestPath), true);
  assert.equal(fs.existsSync(catalogPath), true);
  assert.equal(fs.existsSync(indexPath), true);
  assert.equal(fs.readdirSync(path.join(stageDir, 'public/data')).length, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(catalogPath, 'utf8')).products, []);
  assert.equal(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).live_checkout_enabled, false);
  assert.equal(result.public_routes_published, false);
  assert.equal(result.payment_links_created, false);
  assert.equal(result.files.manifest.absolute_path, manifestPath);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, 'public/procurement-lab')), false);
});

test('rejects collision, invalid slug, invalid color and attempt to overwrite the master', () => {
  assert.throws(() => buildSiloPlan({ slug: 'mtg', title: 'Overwrite Master' }), /MASTER_SLUG_CANNOT_BE_CLONED_OVER/);
  assert.throws(() => buildSiloPlan({ slug: 'developer-assets', title: 'Registry Collision' }), /SILO_SLUG_ALREADY_REGISTERED/);
  assert.throws(() => buildSiloPlan({ slug: '../bad', title: 'Invalid' }), /SLUG_INVALID/);
  assert.throws(() => buildSiloPlan({ slug: 'new-silo', title: 'Invalid color', accent: 'blue' }), /ACCENT_MUST_BE_HEX_COLOR/);
});

test('refuses any staging write into the repository or a non-empty directory', () => {
  assert.throws(() => stageSiloClone({ slug: 'staged-one', title: 'Staged One' }, { stageDir: REPO_ROOT }), /STAGE_DIRECTORY_MUST_BE_OUTSIDE_REPOSITORY/);
  const nonEmpty = emptyStage();
  fs.writeFileSync(path.join(nonEmpty, 'keep.txt'), 'leave me alone');
  assert.throws(() => stageSiloClone({ slug: 'staged-two', title: 'Staged Two' }, { stageDir: nonEmpty }), /STAGE_DIRECTORY_MUST_BE_EMPTY/);
});

test('a successful plan requires the canonical CUBE master and separately registered catalogue-gate contract', () => {
  const plan = buildSiloPlan({ slug: 'creative-lab', title: 'Creative Lab' });
  const manifest = plan.files.manifest.content;
  assert.equal(manifest.clone.source_master_ref, 'silos/mtg/silo.json');
  assert.equal(manifest.clone.catalog_gate_manifest_ref, 'ops/catalog/templates/silo-manifest.v1.json');
  assert.deepEqual(manifest.clone.do_not_copy, [
    'product inventory rows', 'customer data', 'stripe credentials',
    'analytics identities', 'other silo promotion', 'payment links', 'secrets'
  ]);
});
