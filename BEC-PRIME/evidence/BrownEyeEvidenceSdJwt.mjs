import crypto from 'node:crypto';
import { SDJwtInstance } from '@sd-jwt/core';

export const POLICY_VERSION = '1.0.0';
export const ISSUER = 'https://dreamledger.org';

const BASE = ['iss','iat','exp','event_id','event_type','observed_at','truth_status','schema_version','policy_version'];
const TIERS = {
  PUBLIC: [],
  FREE: ['sanitized_summary','category','coarse_outcome'],
  AUTHENTICATED: ['sanitized_summary','category','coarse_outcome','provenance','source_class','verification_method','evidence_version'],
  PAID: ['sanitized_summary','category','coarse_outcome','provenance','source_class','verification_method','evidence_version','detailed_transition_data','richer_provenance','timestamps','actionable_intelligence'],
  HIGH_VALUE: ['sanitized_summary','category','coarse_outcome','provenance','source_class','verification_method','evidence_version','detailed_transition_data','richer_provenance','timestamps','actionable_intelligence','verification_chain','correlated_evidence','counterevidence','detailed_economic_signals'],
  RESTRICTED: []
};
export const NEVER_DISCLOSABLE = ['raw_receipts','pii','credentials','private_silo_material','secrets'];
const SECURITY_CRITICAL = ['iss','aud','exp','nbf','cnf'];

export function disclosureFrameForTier(tier) {
  if (!TIERS[tier]) throw new Error('UNKNOWN_TIER');
  return { _sd: [...TIERS[tier]] };
}

export function claimsForTier(evidence, tier, now=Math.floor(Date.now()/1000), ttl=300) {
  const allowed = new Set(TIERS[tier] ?? []);
  const claims = {
    iss: ISSUER,
    iat: now,
    exp: now + ttl,
    event_id: evidence.event_id,
    event_type: evidence.event_type,
    observed_at: evidence.observed_at,
    truth_status: evidence.truth_status,
    schema_version: evidence.schema_version ?? '1.0.0',
    policy_version: POLICY_VERSION
  };
  for (const key of allowed) {
    if (Object.hasOwn(evidence, key)) claims[key] = evidence[key];
  }
  for (const key of NEVER_DISCLOSABLE) delete claims[key];
  return claims;
}

export function assertPolicyFrame(tier, frame) {
  const expected = [...(TIERS[tier] ?? [])].sort();
  const actual = [...(frame?._sd ?? [])].sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('DISCLOSURE_FRAME_POLICY_MISMATCH');
  if (actual.some(k => SECURITY_CRITICAL.includes(k))) throw new Error('SECURITY_CRITICAL_CLAIM_SELECTIVE');
  if (actual.some(k => NEVER_DISCLOSABLE.includes(k))) throw new Error('RESTRICTED_CLAIM_SELECTIVE');
  return true;
}

export function makeEd25519SdJwt() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const sdjwt = new SDJwtInstance({
    signer: async data => crypto.sign(null, Buffer.from(data), privateKey).toString('base64url'),
    verifier: async (data, sig) => crypto.verify(null, Buffer.from(data), publicKey, Buffer.from(sig, 'base64url')),
    signAlg: 'EdDSA',
    hasher: async (data, alg) => new Uint8Array(crypto.createHash(alg.replace('-', '')).update(data).digest()),
    hashAlg: 'sha-256',
    saltGenerator: async () => crypto.randomBytes(16).toString('base64url')
  });
  return { sdjwt, publicKey };
}

export async function issueEvidenceSdJwt(evidence, tier, options={}) {
  const { sdjwt, publicKey } = makeEd25519SdJwt();
  const claims = claimsForTier(evidence, tier, options.now, options.ttl);
  const frame = disclosureFrameForTier(tier);
  assertPolicyFrame(tier, frame);
  const credential = await sdjwt.issue(claims, frame);
  return { credential, sdjwt, publicKey, frame, claims };
}

export async function presentEvidenceSdJwt(sdjwt, credential, tier) {
  const names = [...(TIERS[tier] ?? [])];
  const presentationFrame = Object.fromEntries(names.map(name => [name, true]));
  return sdjwt.present(credential, presentationFrame);
}

export async function verifyEvidenceSdJwt(sdjwt, presentation) {
  return sdjwt.verify(presentation);
}
