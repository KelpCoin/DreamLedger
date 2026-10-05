'use strict';

/**
 * DreamLedger Trinity — cutting-edge synergy surface
 *
 *   Elohim  = truth / evidence boundary (never invents economic facts)
 *   Gauntlet = decision gate (structured PASS/FAIL on candidates)
 *   Bridge  = agent coordination (passport, notes, rooms, events)
 *
 * Composition: truth_boundary → decision_gate → coordination
 * Money only via Toll Road (settled Stripe → key → wall).
 */

const crypto = require('crypto');
const { run: runGauntlet } = require('../gauntlet/CandidateGauntlet');

const SCHEMA = 'dreamledger/trinity/v1';

function elohimClassify(evidenceInput) {
  const evidence = Array.isArray(evidenceInput?.evidence) ? evidenceInput.evidence : [];
  const contradictions = Array.isArray(evidenceInput?.contradictions) ? evidenceInput.contradictions : [];
  const unresolved = Array.isArray(evidenceInput?.unresolved) ? evidenceInput.unresolved : [];
  const verdict = contradictions.length
    ? 'CONTRADICTED'
    : (evidence.length ? 'OBSERVED' : 'UNVERIFIED');
  return {
    role: 'ELOHIM',
    function: 'truth_boundary',
    verdict,
    evidence_count: evidence.length,
    contradiction_count: contradictions.length,
    unresolved_count: unresolved.length,
    economic_truth_unchanged: true,
    law: 'You cannot pay to make reality look better. Classification only.'
  };
}

function gauntletDecide(candidate) {
  const proof = runGauntlet(candidate || {});
  return {
    role: 'GAUNTLET',
    function: 'decision_gate',
    status: proof.status,
    checks: proof.checks,
    candidate_hash: proof.candidate_hash,
    candidate_offer_id: proof.candidate_offer_id || null,
    public_execution: proof.public_execution || 'AUTOMATED_DIGITAL_RESULT'
  };
}

function bridgeCoordinate({ agentId, roomHint, note, issuePassport }) {
  const passportId = 'PASS-' + crypto.randomUUID().slice(0, 12).toUpperCase();
  const roomId = roomHint || ('ROOM-' + crypto.randomUUID().slice(0, 10).toUpperCase());
  const agent = String(agentId || 'anonymous').slice(0, 64);
  const out = {
    role: 'AGENT_BRIDGE',
    function: 'coordination',
    agent_id: agent,
    passport_id: passportId,
    room_id: roomId,
    note_accepted: Boolean(note),
    presence: 'ATTESTED'
  };
  if (issuePassport) {
    // Lightweight unsigned handle for composition response; full signed token
    // is issued by the toll route when secret is configured (see agent-passport).
    out.passport_handle = passportId;
    out.coordination_status = 'OPEN';
  }
  return out;
}

/**
 * Full synergy run: Elohim → Gauntlet → Bridge
 * Does not create payment, buyer, or settlement facts.
 */
function runTrinity(input, meta) {
  const elohim = elohimClassify(input?.evidence_state || input?.elohim || {});
  const gauntlet = gauntletDecide(input?.candidate || input?.gauntlet || {});

  // Bridge only coordinates fully when not blocked by truth;
  // Gauntlet FAIL still records bridge presence for audit but marks blocked.
  const blockedByTruth = elohim.verdict === 'CONTRADICTED';
  const bridge = bridgeCoordinate({
    agentId: input?.agent_id || input?.bridge?.agent_id,
    roomHint: input?.room_id || input?.bridge?.room_id,
    note: input?.note || input?.bridge?.note,
    issuePassport: !blockedByTruth
  });

  let synergy;
  if (blockedByTruth) synergy = 'BLOCKED_BY_TRUTH';
  else if (gauntlet.status !== 'PASS') synergy = 'BLOCKED_BY_GAUNTLET';
  else synergy = 'ALIGNED';

  return {
    schema: SCHEMA,
    synergy,
    elohim,
    gauntlet,
    bridge,
    composition: 'truth_boundary → decision_gate → coordination',
    economic_truth_unchanged: true,
    key_id: meta?.key_id || null,
    ran_at: new Date().toISOString(),
    note: 'Trinity classifies and coordinates. It does not invent revenue, buyers, or settlements.'
  };
}

/** Minimal deterministic self-check (no I/O, no secrets). */
function selfCheck() {
  const blocked = runTrinity({
    evidence_state: { contradictions: ['test contradiction'] },
    candidate: { offer_id: 'x' }
  });
  const empty = runTrinity({});
  return {
    ok: blocked.synergy === 'BLOCKED_BY_TRUTH' && empty.synergy === 'BLOCKED_BY_GAUNTLET',
    samples: { blocked: blocked.synergy, empty: empty.synergy }
  };
}

module.exports = {
  SCHEMA,
  elohimClassify,
  gauntletDecide,
  bridgeCoordinate,
  runTrinity,
  selfCheck
};
