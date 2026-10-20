'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { stableStringify, createSignedVerdict } = require('../lib/siloCloneContract');

const RELEASE_SCHEMA = 'DREAMLEDGER/FIGURE-EIGHT-OFFLINE-RELEASE/v1';
const MAX_INBOUND_BYTES = 20 * 1024 * 1024;
const SAFE_INBOUND_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.txt', '.md', '.json', '.csv', '.pdf']);
const NEVER_EXECUTE_EXTENSIONS = new Set([
  '.exe', '.dll', '.bat', '.cmd', '.ps1', '.psm1', '.js', '.mjs', '.cjs',
  '.py', '.pyc', '.sh', '.bash', '.zsh', '.sql', '.msi', '.com', '.scr',
  '.pif', '.hta', '.vbs', '.wsf', '.wasm', '.jar', '.class', '.zip', '.7z', '.rar'
]);

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function keyFingerprint(publicKey) {
  const key = crypto.createPublicKey(publicKey);
  return sha256(key.export({ type: 'spki', format: 'der' }));
}

function signReleaseManifest(payload, privateKeyPem) {
  if (!payload || payload.schema !== RELEASE_SCHEMA) throw new Error('Release manifest schema is invalid.');
  return { ...payload, signing: createSignedVerdict(payload, privateKeyPem) };
}

function verifySignedEnvelope(envelope, expectedPublicKeySha256) {
  const errors = [];
  if (!envelope || typeof envelope !== 'object' || !envelope.signing) {
    return { valid: false, errors: ['SIGNATURE_REQUIRED'] };
  }
  const { signing, ...payload } = envelope;
  if (signing.status !== 'SIGNED' || signing.algorithm !== 'Ed25519' ||
      typeof signing.public_key !== 'string' || typeof signing.signature !== 'string') {
    return { valid: false, errors: ['SIGNATURE_SHAPE_INVALID'] };
  }
  let key;
  try {
    key = crypto.createPublicKey(signing.public_key);
    if (key.asymmetricKeyType !== 'ed25519') errors.push('SIGNATURE_KEY_NOT_ED25519');
    const actualFingerprint = keyFingerprint(signing.public_key);
    if (actualFingerprint !== signing.public_key_sha256) errors.push('SIGNING_KEY_FINGERPRINT_MISMATCH');
    if (typeof expectedPublicKeySha256 !== 'string' || !expectedPublicKeySha256) {
      errors.push('TRUSTED_SIGNING_KEY_NOT_CONFIGURED');
    } else if (actualFingerprint !== expectedPublicKeySha256.toLowerCase()) {
      errors.push('SIGNING_KEY_NOT_PINNED');
    }
    if (!errors.length) {
      const signatureOk = crypto.verify(
        null,
        Buffer.from(stableStringify(payload), 'utf8'),
        key,
        Buffer.from(signing.signature, 'base64url')
      );
      if (!signatureOk) errors.push('SIGNATURE_INVALID');
    }
  } catch (_) {
    errors.push('SIGNATURE_PARSE_FAILED');
  }
  return { valid: errors.length === 0, errors, public_key_sha256: signing.public_key_sha256 || null };
}

/**
 * Online-to-offline direction: admit safe file types to quarantine metadata only.
 * This function does not execute, trust, upload, or publish the input.
 */
function prepareInboundQuarantine({ fileName, bytes, sourceRef, contentType = 'application/octet-stream' } = {}) {
  const errors = [];
  if (typeof fileName !== 'string' || !fileName.trim() || path.basename(fileName) !== fileName) {
    errors.push('FILENAME_INVALID');
  }
  const extension = typeof fileName === 'string' ? path.extname(fileName).toLowerCase() : '';
  if (NEVER_EXECUTE_EXTENSIONS.has(extension)) errors.push('EXECUTABLE_OR_ARCHIVE_INPUT_DENIED');
  else if (!SAFE_INBOUND_EXTENSIONS.has(extension)) errors.push('FILE_TYPE_NOT_ALLOWLISTED');
  if (!Buffer.isBuffer(bytes)) errors.push('BYTE_BUFFER_REQUIRED');
  else if (bytes.length === 0 || bytes.length > MAX_INBOUND_BYTES) errors.push('INPUT_SIZE_INVALID');
  if (typeof sourceRef !== 'string' || !sourceRef.trim() || sourceRef.length > 500) errors.push('SOURCE_REFERENCE_REQUIRED');
  if (errors.length) {
    return { schema: 'DREAMLEDGER/FIGURE-EIGHT-QUARANTINE/v1', status: 'BLOCK', trusted: false, errors };
  }
  const digest = sha256(bytes);
  return {
    schema: 'DREAMLEDGER/FIGURE-EIGHT-QUARANTINE/v1',
    status: 'QUARANTINED',
    trusted: false,
    executable: false,
    original_name: fileName,
    quarantine_name: digest + extension,
    sha256: digest,
    bytes: bytes.length,
    content_type_observed: String(contentType).slice(0, 120),
    source_ref: sourceRef,
    requires_offline_scan: true,
    requires_Gauntlet_review: true,
    no_execution_or_publication_performed: true
  };
}

/**
 * Offline-to-online direction: release-readiness verdict only.
 * No networking or publication occurs here.
 */
function verifyOfflineRelease({ manifest, stagingRoot, trustedPublicKeySha256 } = {}) {
  const errors = [];
  if (!manifest || manifest.schema !== RELEASE_SCHEMA) errors.push('RELEASE_MANIFEST_SCHEMA_INVALID');
  if (!manifest || typeof manifest.silo_id !== 'string' || !manifest.silo_id) errors.push('SILO_ID_REQUIRED');
  if (!manifest || typeof manifest.artifact_relative_path !== 'string' ||
      path.isAbsolute(manifest.artifact_relative_path) ||
      manifest.artifact_relative_path.split(/[\\/]/).includes('..')) {
    errors.push('ARTIFACT_PATH_MUST_BE_RELATIVE_AND_CONTAINED');
  }
  if (!manifest || manifest.gauntlet?.status !== 'PASS') errors.push('GAUNTLET_PASS_REQUIRED');
  if (!manifest || manifest.security?.secret_scan !== 'PASS') errors.push('SECRET_SCAN_PASS_REQUIRED');
  if (!manifest || manifest.security?.dependency_scan !== 'PASS') errors.push('DEPENDENCY_SCAN_PASS_REQUIRED');
  if (!manifest || manifest.security?.silo_isolation !== 'PASS') errors.push('SILO_ISOLATION_PASS_REQUIRED');
  if (!manifest || manifest.security?.airgap_review !== 'PASS') errors.push('OFFLINE_REVIEW_PASS_REQUIRED');
  if (!manifest || manifest.human_approval?.approved !== true ||
      typeof manifest.human_approval?.approval_id !== 'string' ||
      !manifest.human_approval.approval_id.trim()) {
    errors.push('HUMAN_RELEASE_APPROVAL_REQUIRED');
  }

  const signature = verifySignedEnvelope(manifest, trustedPublicKeySha256);
  if (!signature.valid) errors.push(...signature.errors);

  let artifactPath = null;
  if (!errors.some(e => e === 'ARTIFACT_PATH_MUST_BE_RELATIVE_AND_CONTAINED')) {
    try {
      if (typeof stagingRoot !== 'string' || !fs.existsSync(stagingRoot)) {
        errors.push('STAGING_ROOT_MISSING');
      } else {
        const root = fs.realpathSync(stagingRoot);
        artifactPath = path.resolve(root, manifest.artifact_relative_path);
        const resolved = path.relative(root, artifactPath);
        if (resolved.startsWith('..') || path.isAbsolute(resolved)) {
          errors.push('ARTIFACT_ESCAPES_STAGING_ROOT');
        } else if (!fs.existsSync(artifactPath) || !fs.lstatSync(artifactPath).isFile() || fs.lstatSync(artifactPath).isSymbolicLink()) {
          errors.push('ARTIFACT_NOT_A_REGULAR_FILE');
        } else {
          const actual = sha256(fs.readFileSync(artifactPath));
          if (actual !== manifest.artifact_sha256) errors.push('ARTIFACT_HASH_MISMATCH');
        }
      }
    } catch (_) {
      errors.push('ARTIFACT_PATH_CHECK_FAILED');
    }
  }

  return {
    schema: 'DREAMLEDGER/FIGURE-EIGHT-RELEASE-DECISION/v1',
    status: errors.length ? 'BLOCK' : 'ALLOW_HANDOFF',
    errors: [...new Set(errors)],
    signature_valid: signature.valid,
    artifact_verified: Boolean(artifactPath) && !errors.includes('ARTIFACT_HASH_MISMATCH'),
    human_approved: manifest?.human_approval?.approved === true,
    network_request_performed: false,
    published: false,
    verified_external_revenue_nzd: 0,
    note: 'ALLOW_HANDOFF means the signed artifact may be presented to the existing release authority; it does not deploy, publish, or assert revenue.'
  };
}

module.exports = {
  RELEASE_SCHEMA,
  MAX_INBOUND_BYTES,
  prepareInboundQuarantine,
  signReleaseManifest,
  verifySignedEnvelope,
  verifyOfflineRelease
};
