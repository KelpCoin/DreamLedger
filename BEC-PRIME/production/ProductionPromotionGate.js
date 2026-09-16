'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { run: runCandidateGauntlet } = require('../gauntlet/CandidateGauntlet');
const { gate: runLeverageGate } = require('../compiler/LeverageGauntlet');

const ROOT = path.resolve(__dirname, '../..');
const CONFIG = Object.freeze({
  refinementDir: path.join(ROOT, 'BEC-PRIME', 'data', 'refinement'),
  queueDir: path.join(ROOT, '.promotion', 'queue'),
  compilerOutDir: path.join(ROOT, 'BEC-PRIME', 'compiled', 'website'),
  cooldownMs: 24 * 60 * 60 * 1000
});

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function safeRunId(runId) {
  if (!runId || !/^RUN-[A-Za-z0-9._-]+$/.test(runId)) throw new Error(`invalid run id: ${runId}`);
  return runId;
}

function runDir(runId) {
  return path.join(CONFIG.refinementDir, safeRunId(runId));
}

function readRunResult(runId) {
  const id = safeRunId(runId);
  const dir = runDir(id);
  const resultPath = path.join(dir, 'RESULT.json');
  const candidatePath = path.join(dir, 'candidate.json');
  const gauntletPath = path.join(dir, 'GAUNTLET-PROOF.json');
  if (!fs.existsSync(resultPath)) throw new Error(`RESULT.json not found for ${id}`);
  if (!fs.existsSync(candidatePath)) throw new Error(`candidate.json not found for ${id}`);
  if (!fs.existsSync(gauntletPath)) throw new Error(`GAUNTLET-PROOF.json not found for ${id}`);

  const result = readJson(resultPath);
  const candidate = readJson(candidatePath);
  const gauntlet = readJson(gauntletPath);

  if (result.run_id && result.run_id !== id) throw new Error(`RESULT run_id mismatch: ${result.run_id}`);
  if (result.status !== 'READY_FOR_APPROVAL') throw new Error(`run ${id} is ${result.status}, not READY_FOR_APPROVAL`);
  if (gauntlet.status !== 'PASS') throw new Error(`run ${id} has a non-passing Candidate Gauntlet proof`);

  const candidateSha = sha256(JSON.stringify(candidate));
  if (gauntlet.candidate_hash && gauntlet.candidate_hash !== candidateSha) {
    throw new Error(`candidate hash mismatch for ${id}`);
  }

  return {
    runId: id,
    dir,
    resultPath,
    candidatePath,
    gauntletPath,
    result,
    candidate,
    gauntlet,
    resultSha256: sha256File(resultPath),
    candidateSha256: candidateSha,
    gauntletSha256: sha256File(gauntletPath)
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, filePath);
}

function cmdQueue(runId) {
  const run = readRunResult(runId);
  const queuePath = path.join(CONFIG.queueDir, `${run.runId}.json`);

  if (fs.existsSync(queuePath)) {
    const existing = readJson(queuePath);
    if (existing.candidate_sha256 !== run.candidateSha256 || existing.result_sha256 !== run.resultSha256) {
      throw new Error(`existing queue entry for ${run.runId} does not match source run hashes`);
    }
    console.log(JSON.stringify(existing, null, 2));
    return existing;
  }

  const queuedAt = new Date().toISOString();
  const readyAt = new Date(Date.now() + CONFIG.cooldownMs).toISOString();
  const queue = {
    schema: 'dreamledger-promotion-queue/v1',
    run_id: run.runId,
    state: 'READY_FOR_APPROVAL',
    silo: run.candidate.silo || null,
    candidate_path: path.relative(ROOT, run.candidatePath).replace(/\\/g, '/'),
    result_path: path.relative(ROOT, run.resultPath).replace(/\\/g, '/'),
    gauntlet_path: path.relative(ROOT, run.gauntletPath).replace(/\\/g, '/'),
    candidate_sha256: run.candidateSha256,
    result_sha256: run.resultSha256,
    gauntlet_sha256: run.gauntletSha256,
    queued_at: queuedAt,
    ready_at: readyAt,
    public_execution: 'BLOCKED_UNTIL_HUMAN_APPROVAL'
  };
  writeJson(queuePath, queue);
  console.log(JSON.stringify(queue, null, 2));
  return queue;
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
  const promotionState = deterministicPass ? 'READY_FOR_APPROVAL' : 'QUARANTINE';

  const result = {
    schema: 'dreamledger-production-promotion-gate/v2',
    candidate_id: candidate.candidate_id || candidate.offer_id || path.basename(candidatePath, '.json'),
    silo: candidate.silo || null,
    promotion_state: promotionState,
    hard_gate: deterministicPass ? 'PASS' : 'FAIL',
    approval_boundary: 'NO_AUTOMATIC_PUBLICATION',
    candidate_hash: sha256(JSON.stringify(candidate)),
    candidate_gauntlet: candidateProof,
    leverage_gauntlet: leverage,
    artifact_error: artifactError,
    elohim: {
      proposal_id: proposalId,
      proposal_valid: proposalValid,
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
  const [command, arg1, arg2] = process.argv.slice(2);
  if (command === 'queue') {
    try {
      cmdQueue(arg1);
    } catch (error) {
      console.error(error.stack || error.message);
      process.exit(1);
    }
  } else {
    const candidatePath = command;
    const proofPath = arg1;
    if (!candidatePath) {
      console.error('Usage: node ProductionPromotionGate.js queue <RUN-id> | <candidate.json> [proof.json]');
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
}

module.exports = { CONFIG, evaluateCandidate, readRunResult, cmdQueue };
