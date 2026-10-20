'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const {
  RELEASE_SCHEMA,
  prepareInboundQuarantine,
  signReleaseManifest,
  verifyOfflineRelease
} = require('./FigureEightMembrane');

const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-figure-eight-'));
const keys = crypto.generateKeyPairSync('ed25519');
const privateKey = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKeyDer = keys.publicKey.export({ type: 'spki', format: 'der' });
const trustedFingerprint = crypto.createHash('sha256').update(publicKeyDer).digest('hex');

after(() => fs.rmSync(stagingRoot, { recursive: true, force: true }));

function releaseManifest(fileBytes) {
  fs.writeFileSync(path.join(stagingRoot, 'hero.png'), fileBytes);
  return signReleaseManifest({
    schema: RELEASE_SCHEMA,
    silo_id: 'mtg',
    artifact_relative_path: 'hero.png',
    artifact_sha256: crypto.createHash('sha256').update(fileBytes).digest('hex'),
    source_commit: 'abc1234',
    gauntlet: { status: 'PASS', verdict_ref: 'gauntlet-run-001' },
    security: {
      secret_scan: 'PASS',
      dependency_scan: 'PASS',
      silo_isolation: 'PASS',
      airgap_review: 'PASS'
    },
    human_approval: { approved: true, approval_id: 'approval-001', approved_by: 'owner' },
    publication_policy: 'EXISTING_RELEASE_GATE_ONLY'
  }, privateKey);
}

test('online-to-offline accepts only allowlisted files and keeps them untrusted', () => {
  const ok = prepareInboundQuarantine({
    fileName: 'product-brief.md',
    bytes: Buffer.from('public source material'),
    sourceRef: 'issue-123',
    contentType: 'text/markdown'
  });
  assert.equal(ok.status, 'QUARANTINED');
  assert.equal(ok.trusted, false);
  assert.equal(ok.executable, false);
  assert.equal(ok.requires_Gauntlet_review, true);
  assert.equal(ok.no_execution_or_publication_performed, true);
});

test('online-to-offline blocks scripts and path-like filenames', () => {
  const script = prepareInboundQuarantine({
    fileName: 'payload.ps1',
    bytes: Buffer.from('Write-Host unsafe'),
    sourceRef: 'untrusted-input'
  });
  assert.equal(script.status, 'BLOCK');
  assert.ok(script.errors.includes('EXECUTABLE_OR_ARCHIVE_INPUT_DENIED'));

  const traversal = prepareInboundQuarantine({
    fileName: '../payload.png',
    bytes: Buffer.from('image'),
    sourceRef: 'untrusted-input'
  });
  assert.equal(traversal.status, 'BLOCK');
  assert.ok(traversal.errors.includes('FILENAME_INVALID'));
});

test('offline-to-online allows only a signed, pinned, hash-matching, scanned, approved artifact', () => {
  const manifest = releaseManifest(Buffer.from('staged artifact bytes'));
  const result = verifyOfflineRelease({
    manifest,
    stagingRoot,
    trustedPublicKeySha256: trustedFingerprint
  });
  assert.equal(result.status, 'ALLOW_HANDOFF', JSON.stringify(result.errors));
  assert.equal(result.signature_valid, true);
  assert.equal(result.artifact_verified, true);
  assert.equal(result.network_request_performed, false);
  assert.equal(result.published, false);
  assert.equal(result.verified_external_revenue_nzd, 0);
});

test('offline-to-online blocks absent human approval and missing security pass', () => {
  const manifest = releaseManifest(Buffer.from('another artifact'));
  manifest.human_approval = { approved: false };
  manifest.security.secret_scan = 'UNKNOWN';
  const result = verifyOfflineRelease({
    manifest,
    stagingRoot,
    trustedPublicKeySha256: trustedFingerprint
  });
  assert.equal(result.status, 'BLOCK');
  assert.ok(result.errors.includes('HUMAN_RELEASE_APPROVAL_REQUIRED'));
  assert.ok(result.errors.includes('SECRET_SCAN_PASS_REQUIRED'));
  assert.ok(result.errors.includes('SIGNATURE_INVALID'));
});

test('offline-to-online blocks altered artifact bytes', () => {
  const manifest = releaseManifest(Buffer.from('expected bytes'));
  fs.writeFileSync(path.join(stagingRoot, 'hero.png'), Buffer.from('changed bytes'));
  const result = verifyOfflineRelease({
    manifest,
    stagingRoot,
    trustedPublicKeySha256: trustedFingerprint
  });
  assert.equal(result.status, 'BLOCK');
  assert.ok(result.errors.includes('ARTIFACT_HASH_MISMATCH'));
});

test('offline-to-online blocks an unpinned signing key', () => {
  const manifest = releaseManifest(Buffer.from('pinned-key check'));
  const result = verifyOfflineRelease({
    manifest,
    stagingRoot,
    trustedPublicKeySha256: '0'.repeat(64)
  });
  assert.equal(result.status, 'BLOCK');
  assert.ok(result.errors.includes('SIGNING_KEY_NOT_PINNED'));
});
