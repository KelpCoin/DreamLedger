'use strict';

const crypto = require('node:crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function required(value, name) {
  const text = String(value == null ? '' : value).trim();
  if (!text) throw new Error(name + ' is required');
  return text;
}

function toBuildJob(signal) {
  if (!signal || typeof signal !== 'object') throw new Error('signal is required');
  const signalId = required(signal.signal_id || signal.candidate_id, 'signal_id');
  const sourceReference = required(signal.source_reference || signal.source_ref || signal.url || signal.source, 'source_reference');
  const input = {
    signal_id: signalId,
    source_reference: sourceReference,
    demand_family: required(signal.demand_family || 'observed_demand', 'demand_family'),
    requested_output: required(signal.requested_output || 'structured_decision_artifact', 'requested_output'),
    substrate_reference: required(signal.substrate_reference || signal.silo_id || 'existing_substrate', 'substrate_reference'),
    transformation_family: required(signal.transformation_family || 'BOUNDED_LOCAL_TRANSFORMATION', 'transformation_family'),
    priority: Number.isFinite(Number(signal.priority)) ? Number(signal.priority) : 0,
    source_payload: signal.source_payload || signal.raw_data || {}
  };
  return {
    job_id: signal.job_id || null,
    signal_id: signalId,
    source_reference: sourceReference,
    demand_family: input.demand_family,
    requested_output: input.requested_output,
    substrate_reference: input.substrate_reference,
    transformation_family: input.transformation_family,
    priority: input.priority,
    input_hash: 'sha256:' + sha256(input),
    input
  };
}

function artifactFor(task, model) {
  const content = String(model.content || '').trim();
  if (!content) throw new Error('LOCAL_BUILD_EMPTY_OUTPUT');
  return {
    schema_version: 'DREAMLEDGER/LOCAL-BUILD-ARTIFACT-1.0',
    job_id: task.job_id,
    signal_id: task.signal_id,
    source_reference: task.source_reference,
    demand_family: task.demand_family,
    transformation_family: task.transformation_family,
    model_identifier: model.model,
    input_hash: task.input_hash,
    output_hash: 'sha256:' + sha256(content),
    content,
    external_action_performed: false,
    economic_claims: {
      payment_claim: false,
      sale_claim: false,
      fulfillment_claim: false,
      verification_claim: false
    },
    created_at: new Date().toISOString()
  };
}

function preparedBoundary() {
  return {
    external_action_required: true,
    approval_required: true,
    revenue_claim_allowed: false
  };
}

module.exports = { sha256, toBuildJob, artifactFor, preparedBoundary };
