'use strict';

const STATUSES = new Set(['VERIFIED','UNVERIFIED','CONTRADICTED','STALE','TEST','SIMULATED','INTERNAL','UNMATCHED']);

function evaluateOutcome(o) {
  const reasons = [];
  const x = o || {};
  if (x.environment === 'test' || x.test_mode === true) return { status:'TEST', reasons:['test_environment'] };
  if (x.simulated === true) return { status:'SIMULATED', reasons:['simulated'] };
  if (x.internal === true) return { status:'INTERNAL', reasons:['internal'] };
  if (x.contradicted === true) return { status:'CONTRADICTED', reasons:['contradictory_evidence'] };
  if (x.stale === true) return { status:'STALE', reasons:['stale_evidence'] };
  if (!x.external_buyer) reasons.push('REAL_EXTERNAL_BUYER');
  if (!x.settled_transaction) reasons.push('REAL_SETTLED_TRANSACTION');
  if (!x.attribution) reasons.push('ATTRIBUTION');
  if (!x.fulfilled) reasons.push('FULFILMENT');
  if (!x.evidence) reasons.push('EVIDENCE');
  return reasons.length ? { status:'UNVERIFIED', reasons } : { status:'VERIFIED', reasons:[] };
}

function assertNoSilentUpgrade(previousStatus, nextStatus, evidence) {
  if (!STATUSES.has(nextStatus)) throw new Error('invalid business truth status');
  if (nextStatus === 'VERIFIED') {
    const r = evaluateOutcome(evidence);
    if (r.status !== 'VERIFIED') throw new Error('VERIFIED requires external buyer, settled transaction, attribution, fulfilment and evidence');
  }
  if (previousStatus === 'VERIFIED' && nextStatus !== 'VERIFIED') throw new Error('verified truth cannot be silently downgraded');
  return true;
}

module.exports = { STATUSES:[...STATUSES], evaluateOutcome, assertNoSilentUpgrade };
