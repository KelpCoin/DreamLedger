'use strict';
export const VERDICTS = ['VERIFIED_MATCH','MISMATCH','INSUFFICIENT_EVIDENCE','UNAVAILABLE'];
export function validateVerdict(x) { return !!x && x.schema_version === 'dreamledger.tri-llm-verdict/v1' && VERDICTS.includes(x.verdict) && typeof x.rationale === 'string' && x.rationale.trim().length > 0 && Array.isArray(x.evidence_refs) && Array.isArray(x.limitations); }
