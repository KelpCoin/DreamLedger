'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { run: runCandidateGauntlet } = require('../gauntlet/CandidateGauntlet');
const { gate: runLeverageGate } = require('../compiler/LeverageGauntlet');

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function evaluateCandidate(candidatePath, proofPath) {
  const absoluteCandidate = path.resolve(candidatePath);
  const candidate = readJson(absoluteCandidate);
  const proofRoot = proofPath ? path.resolve(proofPath) : null;

  const candidateProof = runCandidateGauntlet(
    candidate,
    proofRoot ? proofRoot.replace(/\.json$/, '.candidate-gauntlet.json') : undefined
  );

  let artifactPath = candidate.artifact_path || candidate.artifact?.path || candidate.deliverable_artifact;
  if (!artifactPath && candidate.deliverable && typeof candidate.deliverable === 'object') {
    artifactPath = candidate.deliverable.artifact_path;
  }

  let leverage = null;
  let artifactError = null;
  if (artifactPath) {
    try {
      leverage = await runLeverageGate({
        artifact: artifactPath,
        kind: candidate.artifact_kind || candidate.artifact?.kind || 'html',
        compiler: candidate.compiler || 'BrownEyeCortex-UniversalCompiler'
      });
    } catch (error) {
      artifactError = error.message;
    }
  } else {
    artifactError = 'Candidate must declare artifact_path, artifact.path, or deliverable_artifact';
  }

  const proposalId = leverage?.elohim_proposal_id || null;
  const proposalValid = Boolean(proposalId && leverage?.gauntlet?.verdict === 'PASS');
  const deterministicPass = candidateProof.status === 'PASS' && !artifactError && leverage?.verdict === 'PASS';
  const readyState = candidate.state === 'READY_FOR_APPROVAL';

  let promotionState = 'QUARANTINE';
  if (deterministicPass && readyState && proposalValid) promotionState = 'READY_FOR_APPROVAL';

  const result = {
    schema: 'dreamledger-production-promotion-gate/v1',
    candidate_id: candidate.candidate_id || candidate.offer_id || path.basename(candidatePath, '.json'),
    silo: candidate.silo || null,
    candidate_state: candidate.state || null,
    promotion_state: promotionState,
    hard_gate: deterministicPass ? 'PASS' : 'FAIL',
    approval_boundary: 'NO_AUTOMATIC_PUBLICATION',
    candidate_hash: sha256(JSON.stringify(candidate)),
    candidate_gauntlet: candidateProof,
    leverage_gauntlet: leverage,
    artifact_error: artifactError,
    elohim: {
      proposal_id: proposalId,
      role: 'ADVISORY_PROPOSAL_ONLY',
      can_publish: false,
      can_charge_customer: false,
      can_execute_external_action: false
    },
    evaluated_at: new Date().toISOString()
  };

  if (proofRoot) {
    fs.mkdirSync(path.dirname(proofRoot), { recursive: true });
    fs.writeFileSync(proofRoot, JSON.stringify(result, null, 2) + '\n', 'utf8');
  }

  return result;
}

if (require.main === module) {
  const candidatePath = process.argv[2];
  const proofPath = process.argv[3];
  if (!candidatePath) {
    console.error('Usage: node ProductionPromotionGate.js <candidate.json> [proof.json]');
    process.exit(2);
  }
  evaluateCandidate(candidatePath, proofPath)
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.promotion_state === 'READY_FOR_APPROVAL' ? 0 : 1);
    })
    .catch(error => {
      console.error(error.stack || error.message);
      process.exit(1);
    });
}

module.exports = { evaluateCandidate };
