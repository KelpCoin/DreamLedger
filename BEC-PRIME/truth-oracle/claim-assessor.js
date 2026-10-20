'use strict';

const crypto = require('node:crypto');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(stable(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function isoDate(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && value.includes('T');
}

function safeEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object') return false;
  if (typeof evidence.evidence_id !== 'string' || !evidence.evidence_id.trim()) return false;
  if (evidence.admission_status !== 'VERIFIED') return false;
  if (!isSha256(evidence.content_sha256)) return false;
  if (!isoDate(evidence.observed_at)) return false;
  if (typeof evidence.excerpt !== 'string' || !evidence.excerpt.trim()) return false;
  if (typeof evidence.independence_group !== 'string' || !evidence.independence_group.trim()) return false;
  if (!['PRIMARY', 'SECONDARY', 'TERTIARY', 'USER_SUPPLIED'].includes(evidence.source_role)) return false;
  if (!['SUPPORTS', 'CONTRADICTS', 'CONTEXT'].includes(evidence.relation)) return false;
  if (typeof evidence.source_url !== 'string') return false;
  try {
    const url = new URL(evidence.source_url);
    if (url.protocol !== 'https:' || !url.hostname) return false;
  } catch {
    return false;
  }
  return true;
}

function assessClaim(input, contract) {
  const policy = contract && contract.defaults;
  const statuses = contract && contract.statuses;
  if (!policy || !Array.isArray(statuses) || !input || typeof input !== 'object') {
    throw new Error('INVALID_CLAIM_ASSESSMENT_INPUT');
  }
  if (typeof input.claim_id !== 'string' || !input.claim_id.trim()) throw new Error('CLAIM_ID_REQUIRED');
  if (typeof input.claim_text !== 'string' || !input.claim_text.trim()) throw new Error('CLAIM_TEXT_REQUIRED');
  if (!isoDate(input.evaluated_at)) throw new Error('EVALUATED_AT_MUST_BE_ISO_DATETIME');

  const seenIds = new Set();
  const rawEvidence = Array.isArray(input.evidence) ? input.evidence : [];
  const evidence = rawEvidence.filter((item) => {
    if (!safeEvidence(item) || seenIds.has(item.evidence_id)) return false;
    seenIds.add(item.evidence_id);
    return true;
  }).sort((a, b) => a.evidence_id.localeCompare(b.evidence_id));

  const evidenceById = new Map(evidence.map((item) => [item.evidence_id, item]));
  const checks = (Array.isArray(input.deterministic_checks) ? input.deterministic_checks : [])
    .filter((check) => check && typeof check.check_id === 'string' &&
      typeof check.verifier_id === 'string' && check.verifier_id.trim() &&
      ['PASS', 'FAIL', 'INDETERMINATE'].includes(check.status) &&
      Array.isArray(check.evidence_ids) && check.evidence_ids.length > 0 &&
      check.evidence_ids.every((id) => evidenceById.has(id)))
    .map((check) => ({
      check_id: check.check_id,
      verifier_id: check.verifier_id,
      status: check.status,
      evidence_ids: [...new Set(check.evidence_ids)].sort()
    }))
    .sort((a, b) => a.check_id.localeCompare(b.check_id));

  const supports = evidence.filter((item) => item.relation === 'SUPPORTS');
  const contradicts = evidence.filter((item) => item.relation === 'CONTRADICTS');
  const supportGroups = new Set(supports.map((item) => item.independence_group));
  const contradictGroups = new Set(contradicts.map((item) => item.independence_group));
  const primarySupportGroups = new Set(supports.filter((item) => item.source_role === 'PRIMARY').map((item) => item.independence_group));
  const primaryContradictGroups = new Set(contradicts.filter((item) => item.source_role === 'PRIMARY').map((item) => item.independence_group));
  const conflicts = supports.length > 0 && contradicts.length > 0;
  const hasIndeterminate = checks.some((check) => check.status === 'INDETERMINATE');
  const hasFailed = checks.some((check) => check.status === 'FAIL');
  const allChecksPass = checks.length > 0 && checks.every((check) => check.status === 'PASS');
  const checksAreEvidenceBacked = checks.length > 0 &&
    checks.every((check) => check.evidence_ids.length > 0 &&
      check.evidence_ids.some((id) => {
        const item = evidenceById.get(id);
        return item && (item.source_role === 'PRIMARY' || item.source_role === 'SECONDARY');
      }));
  const minVerified = Number(policy.minimum_independent_primary_source_groups_for_verified);
  const minLikely = Number(policy.minimum_independent_supporting_source_groups_for_likely);
  let status = 'UNVERIFIED';
  let reasonCode = 'INSUFFICIENT_ADMITTED_EVIDENCE';

  if (conflicts || hasIndeterminate) {
    status = 'UNCERTAIN';
    reasonCode = conflicts ? 'CONFLICTING_ADMITTED_EVIDENCE' : 'DETERMINISTIC_CHECK_INDETERMINATE';
  } else if (hasFailed && primaryContradictGroups.size >= minVerified && primarySupportGroups.size === 0) {
    status = 'CONTRADICTED';
    reasonCode = 'INDEPENDENT_PRIMARY_EVIDENCE_AND_CHECKS_CONTRADICT_CLAIM';
  } else if (!hasFailed && primaryContradictGroups.size >= minVerified && primarySupportGroups.size === 0) {
    status = 'CONTRADICTED';
    reasonCode = 'INDEPENDENT_PRIMARY_EVIDENCE_CONTRADICTS_CLAIM';
  } else if (allChecksPass && checksAreEvidenceBacked &&
      primarySupportGroups.size >= minVerified && contradicts.length === 0) {
    status = 'VERIFIED';
    reasonCode = 'INDEPENDENT_PRIMARY_EVIDENCE_AND_DETERMINISTIC_CHECKS_PASS';
  } else if (supportGroups.size >= minLikely && contradicts.length === 0 && !hasFailed) {
    status = 'LIKELY';
    reasonCode = 'MULTI_SOURCE_CORROBORATION_WITHOUT_FULL_VERIFICATION';
  } else if (supports.length > 0 && contradicts.length > 0) {
    status = 'UNCERTAIN';
    reasonCode = 'MIXED_EVIDENCE';
  }

  const sourceSummary = {
    admitted_evidence_count: evidence.length,
    rejected_evidence_count: rawEvidence.length - evidence.length,
    supporting_evidence_count: supports.length,
    contradicting_evidence_count: contradicts.length,
    independent_support_groups: supportGroups.size,
    independent_contradiction_groups: contradictGroups.size,
    independent_primary_support_groups: primarySupportGroups.size,
    independent_primary_contradiction_groups: primaryContradictGroups.size,
    deterministic_check_count: checks.length,
    deterministic_checks_passed: checks.filter((check) => check.status === 'PASS').length,
    deterministic_checks_failed: checks.filter((check) => check.status === 'FAIL').length
  };

  const receipt = {
    schema: 'dreamledger/truth-oracle-receipt/v1',
    claim_id: input.claim_id,
    claim_text: input.claim_text,
    claim_type: typeof input.claim_type === 'string' ? input.claim_type : 'UNSPECIFIED',
    status,
    reason_code: reasonCode,
    evaluated_at: input.evaluated_at,
    evidence: evidence.map((item) => ({
      evidence_id: item.evidence_id,
      source_url: item.source_url,
      source_role: item.source_role,
      independence_group: item.independence_group,
      observed_at: item.observed_at,
      content_sha256: item.content_sha256,
      relation: item.relation
    })),
    deterministic_checks: checks,
    source_summary: sourceSummary,
    confidence: input.calibration && input.calibration.status === 'VALIDATED' &&
      typeof input.calibration.confidence === 'number' &&
      Number.isFinite(input.calibration.confidence) &&
      input.calibration.confidence >= 0 && input.calibration.confidence <= 1
      ? input.calibration.confidence
      : null,
    calibration_ref: input.calibration && input.calibration.status === 'VALIDATED'
      ? (input.calibration.record_ref || null)
      : null,
    disclaimers: [
      'Verdicts apply only to the stated claim and admitted evidence snapshot.',
      'Model agreement is not independent evidence.',
      'A signed receipt proves receipt integrity, not the truth of the claim.',
      'No calibrated confidence is stated without a validated calibration record.'
    ]
  };
  receipt.evidence_hash = sha256(canonicalJson(receipt));
  receipt.receipt_hash = sha256(canonicalJson(receipt));
  return receipt;
}

function signReceipt(receipt, privateKeyPem, keyId) {
  if (typeof privateKeyPem !== 'string' || !privateKeyPem.trim()) {
    throw new Error('TRUTH_ORACLE_SIGNING_KEY_NOT_CONFIGURED');
  }
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('ED25519_PRIVATE_KEY_REQUIRED');
  if (!receipt || typeof receipt !== 'object' || !receipt.receipt_hash) throw new Error('VALID_RECEIPT_REQUIRED');
  const payload = canonicalJson(receipt);
  const signature = crypto.sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64');
  return {
    schema: 'dreamledger/truth-oracle-signed-receipt/v1',
    key_id: typeof keyId === 'string' && keyId.trim() ? keyId : 'UNSPECIFIED_KEY_ID',
    algorithm: 'Ed25519',
    receipt,
    signature
  };
}

function verifySignedReceipt(signedReceipt, publicKeyPem) {
  try {
    if (!signedReceipt || signedReceipt.schema !== 'dreamledger/truth-oracle-signed-receipt/v1' ||
        signedReceipt.algorithm !== 'Ed25519' || !signedReceipt.receipt || typeof signedReceipt.signature !== 'string') return false;
    const publicKey = crypto.createPublicKey(publicKeyPem);
    if (publicKey.asymmetricKeyType !== 'ed25519') return false;
    return crypto.verify(null, Buffer.from(canonicalJson(signedReceipt.receipt), 'utf8'), publicKey,
      Buffer.from(signedReceipt.signature, 'base64'));
  } catch {
    return false;
  }
}

module.exports = { assessClaim, signReceipt, verifySignedReceipt, canonicalJson, sha256 };
