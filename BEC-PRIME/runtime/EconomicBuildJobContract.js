'use strict';

const crypto = require('node:crypto');

const BUILD_JOB_SCHEMA = 'DREAMLEDGER/ECONOMIC-BUILD-JOB/v1';
const ARTIFACT_SCHEMA = 'DREAMLEDGER/LOCAL-BUILD-ARTIFACT/v1';

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function required(value, name) {
  const v = String(value == null ? '' : value).trim();
  if (!v) throw new Error(name + '_REQUIRED');
  return v;
}

function buildJobFromSignal(signal, context = {}) {
  if (!signal || typeof signal !== 'object') throw new Error('SIGNAL_REQUIRED');
  const signalId = required(signal.signal_id, 'SIGNAL_ID');
  const source = required(signal.source, 'SIGNAL_SOURCE');
  const sourceReference = required(signal.source_ref || context.source_reference, 'SOURCE_REFERENCE');
  const requestedOutput = required(
    context.requested_output || signal.raw_data?.requested_output || 'bounded economic transformation artifact',
    'REQUESTED_OUTPUT'
  );
  const input = {
    signal_id: signalId,
    source,
    source_reference: sourceReference,
    buyer_problem: signal.problem_text || null,
    requested_output: requestedOutput,
    price_signal: signal.estimated_value_nzd ?? signal.raw_data?.price_signal ?? null,
    demand_family: context.demand_family || signal.raw_data?.demand_family || 'economic_transformation',
    substrate_required: context.substrate_reference || signal.raw_data?.substrate_required || null,
    transformation_family: context.transformation_family || signal.raw_data?.transformation_family || 'bounded_local_transformation'
  };
  return {
    schema_version: BUILD_JOB_SCHEMA,
    job_id: context.job_id || ('BUILD-' + sha256(JSON.stringify(input)).slice(0, 24).toUpperCase()),
    signal_id: signalId,
    source_reference: sourceReference,
    demand_family: input.demand_family,
    requested_output: requestedOutput,
    substrate_reference: input.substrate_required,
    transformation_family: input.transformation_family,
    priority: Number.isFinite(Number(context.priority)) ? Number(context.priority) : 50,
    input_hash: sha256(JSON.stringify(input)),
    status: 'READY',
    worker_role: context.worker_role || 'LOCAL_ELOHIM_BUILDER',
    model_identifier: null,
    output_hash: null,
    artifact_reference: null,
    failure_reason: null,
    created_at: context.created_at || new Date().toISOString(),
    completed_at: null,
    provenance: {
      signal_id: signalId,
      source,
      source_reference: sourceReference,
      source_status: signal.status || 'UNVERIFIED'
    }
  };
}

function artifactFromWorker(job, content, modelIdentifier, artifactReference) {
  if (!job || job.schema_version !== BUILD_JOB_SCHEMA) throw new Error('INVALID_BUILD_JOB');
  const text = String(content == null ? '' : content);
  if (!text.trim()) throw new Error('ARTIFACT_CONTENT_REQUIRED');
  const outputHash = sha256(text);
  return {
    schema_version: ARTIFACT_SCHEMA,
    job_id: job.job_id,
    signal_id: job.signal_id,
    source_reference: job.source_reference,
    model_identifier: required(modelIdentifier, 'MODEL_IDENTIFIER'),
    input_hash: job.input_hash,
    output_hash: outputHash,
    artifact_reference: required(artifactReference, 'ARTIFACT_REFERENCE'),
    status: 'ARTIFACT_READY',
    external_action_performed: false,
    revenue_claimed: false,
    payment_claimed: false,
    fulfillment_claimed: false,
    verification_claimed: false,
    provenance: job.provenance
  };
}

function laneManifestInput(job, artifact) {
  if (!job || !artifact || job.job_id !== artifact.job_id) throw new Error('PROVENANCE_MISMATCH');
  return {
    schema_version: 'DREAMLEDGER/LOCAL-BUILD-LANE-INPUT/v1',
    candidate_id: job.job_id,
    signal_id: job.signal_id,
    source_reference: job.source_reference,
    substrate_requirements: job.substrate_reference,
    demand_family: job.demand_family,
    transformation_family: job.transformation_family,
    buyer_output: {
      format: 'structured_artifact',
      artifact_reference: artifact.artifact_reference,
      output_hash: artifact.output_hash
    },
    commercial_boundary: {
      price_nzd: 0,
      external_action_required: true,
      approval_required: true,
      revenue_claim_allowed: false
    },
    commerce_path: {
      checkout: 'existing commerce rail',
      fulfillment: 'existing bounded fulfillment adapter',
      proof: 'EXISTING_PROOF_SPINE'
    },
    kill_criteria: ['source becomes stale', 'artifact validation fails', 'contradictory evidence'],
    provenance: {
      signal_id: job.signal_id,
      build_job_id: job.job_id,
      input_hash: job.input_hash,
      artifact_hash: artifact.output_hash
    }
  };
}

module.exports = { BUILD_JOB_SCHEMA, ARTIFACT_SCHEMA, sha256, buildJobFromSignal, artifactFromWorker, laneManifestInput };
