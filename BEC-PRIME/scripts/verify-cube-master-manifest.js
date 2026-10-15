'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { buildCandidate, writeCandidate } = require('../cube/CubeCloneFactory');

const REPO_ROOT = path.resolve(__dirname, '../..');
const MASTER_PATH = path.join(REPO_ROOT, 'silos', 'mtg', 'silo.json');
const PUBLIC_MASTER_PATH = path.join(REPO_ROOT, 'public', 'silos', 'mtg', 'silo.json');
const PUBLIC_POINTER_PATH = path.join(REPO_ROOT, 'public', 'silo-clone-manifest.json');
const REGISTRY_PATH = path.join(__dirname, '..', 'catalog', 'silos', 'CUBE-SILO-REGISTRY.json');
const SCHEMA_PATH = path.join(__dirname, '..', 'cube', 'CUBE-CLONE-MANIFEST.schema.json');
const LEGACY_CLONE_PATHS = [path.join(__dirname, '..', 'cube', 'CUBE-Clone.ps1'), path.join(__dirname, '..', 'cube', 'CUBE-Clone-Silo.ps1')];
const PROOF_PATH = path.join(__dirname, '..', 'data', 'proofs', 'CUBE-CLEAN-CLONE-TEST-PROOF.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
function validateClone(manifest, catalog, expectedSlug) {
  const checks = [];
  const check = (name, fn) => {
    let passed = false;
    try { fn(); passed = true; } catch {}
    checks.push({ name, passed });
  };

  check('canonical_schema', () => assert.equal(manifest.schema, 'BEC-PRIME/CUBE-CLONE-MANIFEST/v1'));
  check('empty_catalog', () => assert.deepEqual(catalog.products, []));
  check('inventory_not_copied', () => assert.equal(catalog.products.length, 0));
  check('credentials_not_copied', () => assert.doesNotMatch(JSON.stringify({ manifest, catalog }), /sk_live_|sk_test_|whsec_|service_role|stripe_secret/i));
  check('customer_data_not_copied', () => assert.doesNotMatch(JSON.stringify({ manifest, catalog }), /customer_email|customer_id|account_id|buyer_id/i));
  check('route_isolation', () => {
    assert.equal(manifest.slug, expectedSlug);
    assert.equal(manifest.route, '/' + expectedSlug + '/');
    assert.equal(manifest.catalog, '/data/' + expectedSlug + '-catalog.json');
    assert.notEqual(manifest.route, '/mtg/');
  });
  check('checkout_disabled_by_default', () => assert.equal(manifest.clone.checkout_default, 'disabled'));
  check('gauntlet_and_approval_required', () => {
    assert.equal(manifest.clone.release_requires_clean_clone_fossil, true);
    assert.ok(manifest.clone.activation_requires.includes('gauntlet_pass'));
    assert.ok(manifest.clone.activation_requires.includes('human_publish_approval'));
    assert.equal(manifest.status, 'candidate');
  });
  return checks;
}

function run() {
  const master = readJson(MASTER_PATH);
  const publicMaster = readJson(PUBLIC_MASTER_PATH);
  const publicPointer = readJson(PUBLIC_POINTER_PATH);
  const registry = readJson(REGISTRY_PATH);
  const schema = readJson(SCHEMA_PATH);
  const entry = (registry.silos || []).find(s => s.id === 'mtg');
  const checks = [];
  const check = (name, fn) => {
    let passed = false;
    let detail = '';
    try { fn(); passed = true; } catch (e) { detail = e.message; }
    checks.push({ name, passed, detail: detail || undefined });
  };

  check('master_manifest_schema', () => assert.equal(master.schema, 'BEC-PRIME/CUBE-CLONE-MANIFEST/v1'));
  check('public_master_matches_canonical_source', () => assert.deepEqual(publicMaster, master));
  check('public_manifest_file_is_pointer_only', () => {
    assert.equal(publicPointer.schema, 'dreamledger/manifest-pointer/v1');
    assert.equal(publicPointer.canonical_manifest, '/silos/mtg/silo.json');
    assert.equal(Object.hasOwn(publicPointer, 'clones'), false);
    assert.equal(Object.hasOwn(publicPointer, 'products'), false);
  });
  check('canonical_schema_matches_master', () => assert.equal(schema.properties?.schema?.const, master.schema));
  check('legacy_product_specific_schema_removed', () => {
    assert.equal(schema.properties?.stripe_product_id, undefined);
    assert.equal(schema.properties?.price_nzd, undefined);
    assert.equal(schema.required.includes('stripe_product_id'), false);
  });
  check('legacy_clone_entrypoints_use_factory', () => {
    for (const file of LEGACY_CLONE_PATHS) {
      const source = fs.readFileSync(file, 'utf8');
      assert.ok(source.includes('CubeCloneFactory.js'));
      assert.equal(/StripeProductId|CreateRemote|\$Push/.test(source), false);
    }
  });
  check('master_manifest_source_of_truth', () => assert.equal(master.clone.source_of_truth, 'silos/mtg/silo.json'));
  check('master_inventory_policy', () => assert.equal(master.inventory_policy, 'empty_until_verified_supply'));
  check('master_payment_truth', () => assert.equal(master.payment_truth, 'settled_payment_only'));
  check('all_silo_isolation_flags', () => assert.ok(Object.values(master.isolation).every(v => v === true)));
  check('clone_inventory_copy_disabled', () => assert.equal(master.clone.inventory_copy, false));
  check('clone_customer_data_copy_disabled', () => assert.equal(master.clone.customer_data_copy, false));
  check('clone_credential_copy_disabled', () => assert.equal(master.clone.credential_copy, false));
  check('clone_checkout_disabled_by_default', () => assert.equal(master.clone.checkout_default, 'disabled'));
  check('registry_resolves_mtg_master', () => {
    assert.ok(entry);
    assert.equal(entry.manifest_path, 'silos/mtg/silo.json');
    assert.equal(entry.manifest_schema, 'BEC-PRIME/CUBE-CLONE-MANIFEST/v1');
  });
  check('registry_reference_not_promoted_without_fossil', () => {
    assert.equal(registry.master_template?.id, 'mtg');
    assert.equal(registry.master_template?.template_role, 'candidate_reference');
    assert.equal(registry.master_template?.clone_fossil_status, 'NOT_RUN');
    assert.equal(entry?.template_role, 'candidate_reference');
  });

  const testSlug = 'clean-clone-test';
  const candidate = buildCandidate(master, testSlug, 'Clean Clone Test', 'Test');
  const clone = candidate.manifest;
  const emptyCatalog = candidate.catalog;
  check('factory_candidate_assertions', () => {
    const a = candidate.proof.assertions;
    assert.equal(a.source_resolved_through_registry, true);
    assert.equal(a.inventory_copied, false);
    assert.equal(a.customer_data_copied, false);
    assert.equal(a.credentials_copied, false);
    assert.equal(a.route_isolated, true);
    assert.equal(a.catalog_empty, true);
    assert.equal(a.checkout_disabled, true);
    assert.equal(a.gauntlet_and_human_approval_required, true);
    assert.equal(candidate.proof.status, 'CANDIDATE_GENERATED');
    assert.equal(candidate.proof.release_status, 'HOLD');
  });

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-cube-clone-'));
  let cloneChecks = [];
  try {
    const written = writeCandidate(temp, candidate);
    const rereadManifest = readJson(written.manifestPath);
    const rereadCatalog = readJson(written.catalogPath);
    const rereadProof = readJson(written.proofPath);
    check('factory_artifact_routes_match_manifest', () => {
      assert.equal(path.relative(temp, written.manifestPath).replace(/\\/g, '/'), 'silos/' + testSlug + '/silo.json');
      assert.equal(path.relative(temp, written.catalogPath).replace(/\\/g, '/'), 'data/' + testSlug + '-catalog.json');
      assert.equal(rereadManifest.manifest_path, '/' + path.relative(temp, written.manifestPath).replace(/\\/g, '/'));
      assert.equal(rereadManifest.catalog, '/' + path.relative(temp, written.catalogPath).replace(/\\/g, '/'));
      assert.equal(rereadProof.release_status, 'HOLD');
    });
    cloneChecks = validateClone(rereadManifest, rereadCatalog, testSlug);
    checks.push(...cloneChecks.map(x => ({ ...x, name: 'clean_clone.' + x.name })));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }

  const failed = checks.filter(x => !x.passed);
  const proof = {
    schema: 'BEC-PRIME/CUBE-CLEAN-CLONE-TEST-PROOF/v1',
    status: failed.length ? 'FAIL' : 'PASS',
    tested_at_utc: new Date().toISOString(),
    master_manifest: 'silos/mtg/silo.json',
    master_manifest_sha256: sha256(JSON.stringify(master)),
    registry: 'BEC-PRIME/catalog/silos/CUBE-SILO-REGISTRY.json',
    registry_sha256: sha256(JSON.stringify(registry)),
    assertions_passed: checks.filter(x => x.passed).length,
    assertions_total: checks.length,
    checks,
    release_status: 'HOLD',
    promotion_rule: 'This dry-run proves the clean-clone contract only. A real clone fossil and independent Gauntlet pass are still required before registry promotion or publication.'
  };
  fs.mkdirSync(path.dirname(PROOF_PATH), { recursive: true });
  fs.writeFileSync(PROOF_PATH, JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify({ ...proof, proof_path: path.relative(REPO_ROOT, PROOF_PATH) }, null, 2));
  if (failed.length) process.exitCode = 1;
  return proof;
}

if (require.main === module) run();
module.exports = { run, validateClone };
