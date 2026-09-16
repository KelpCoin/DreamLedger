'use strict';

const crypto = require('crypto');

const SIGNAL_TYPES = new Set(['POSITIVE', 'NEGATIVE', 'SYNTHESIZED', 'TRIANGULATED']);
const AUTONOMY_LEVELS = new Set(['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6']);
const RISK_CLASSES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function now() {
  return new Date().toISOString();
}

function requiredString(value, name) {
  const result = String(value || '').trim();
  if (!result) throw new Error(name + '_REQUIRED');
  return result;
}

function normaliseBlueprint(input) {
  const blueprint = {
    schema_version: 'factory-blueprint-v1',
    id: requiredString(input.id, 'BLUEPRINT_ID'),
    name: requiredString(input.name, 'BLUEPRINT_NAME'),
    version: String(input.version || '1'),
    description: String(input.description || ''),
    purpose: requiredString(input.purpose, 'BLUEPRINT_PURPOSE'),
    inputs: Array.isArray(input.inputs) ? input.inputs : [],
    outputs: Array.isArray(input.outputs) ? input.outputs : [],
    capabilities: Array.isArray(input.capabilities) ? input.capabilities : [],
    autonomy_ceiling: input.autonomy_ceiling || 'L1',
    risk_class: input.risk_class || 'LOW',
    action_budget: Number.isFinite(Number(input.action_budget)) ? Number(input.action_budget) : 10,
    kill_switch: requiredString(input.kill_switch || 'GLOBAL_FACTORY_KILL_SWITCH', 'KILL_SWITCH'),
    success_contract: input.success_contract || { type: 'deterministic', required: true },
    evidence_contract: input.evidence_contract || { required: true, source: 'truth-oracle' },
    created_at: input.created_at || now()
  };

  if (!AUTONOMY_LEVELS.has(blueprint.autonomy_ceiling)) throw new Error('INVALID_AUTONOMY_LEVEL');
  if (!RISK_CLASSES.has(blueprint.risk_class)) throw new Error('INVALID_RISK_CLASS');
  if (blueprint.action_budget < 1 || blueprint.action_budget > 10000) throw new Error('INVALID_ACTION_BUDGET');
  return blueprint;
}

function instantiate(blueprint, options) {
  const b = normaliseBlueprint(blueprint);
  const o = options || {};
  const instance = {
    schema_version: 'factory-instance-v1',
    instance_id: String(o.instance_id || 'factory_' + crypto.randomUUID()),
    blueprint_id: b.id,
    blueprint_version: b.version,
    name: String(o.name || b.name),
    silo: String(o.silo || 'dreamledger'),
    autonomy_level: o.autonomy_level || 'L1',
    status: 'PLACED',
    configuration: o.configuration || {},
    created_at: now(),
    blueprint_sha256: sha256(b)
  };
  if (!AUTONOMY_LEVELS.has(instance.autonomy_level)) throw new Error('INVALID_AUTONOMY_LEVEL');
  if (AUTONOMY_LEVELS.has(b.autonomy_ceiling) && Number(instance.autonomy_level.slice(1)) > Number(b.autonomy_ceiling.slice(1))) {
    throw new Error('AUTONOMY_EXCEEDS_BLUEPRINT_CEILING');
  }
  return instance;
}

function clone(instance, overrides) {
  return instantiate({
    id: instance.blueprint_id,
    name: instance.name,
    version: instance.blueprint_version,
    purpose: 'Cloned factory instance',
    autonomy_ceiling: instance.autonomy_level,
    capabilities: [],
    inputs: [],
    outputs: [],
    action_budget: 10,
    kill_switch: 'GLOBAL_FACTORY_KILL_SWITCH'
  }, {
    ...overrides,
    name: overrides && overrides.name ? overrides.name : instance.name + ' clone',
    configuration: {
      ...(instance.configuration || {}),
      ...((overrides && overrides.configuration) || {})
    }
  });
}

function startRun(instance, objective, context) {
  return {
    schema_version: 'factory-run-v1',
    run_id: 'run_' + crypto.randomUUID(),
    instance_id: requiredString(instance.instance_id, 'INSTANCE_ID'),
    objective: requiredString(objective, 'OBJECTIVE'),
    context: context || {},
    status: 'STARTED',
    started_at: now()
  };
}

function recordOutcome(run, outcome) {
  const value = {
    schema_version: 'factory-outcome-v1',
    run_id: requiredString(run.run_id, 'RUN_ID'),
    status: outcome && outcome.status ? outcome.status : 'UNKNOWN',
    expected: outcome && outcome.expected !== undefined ? outcome.expected : null,
    observed: outcome && outcome.observed !== undefined ? outcome.observed : null,
    evidence_refs: Array.isArray(outcome && outcome.evidence_refs) ? outcome.evidence_refs : [],
    verifier: outcome && outcome.verifier ? outcome.verifier : null,
    observed_at: now()
  };
  if (!value.evidence_refs.length && value.status === 'SUCCESS') throw new Error('SUCCESS_REQUIRES_EVIDENCE');
  return value;
}

function signal(run, type, payload) {
  if (!SIGNAL_TYPES.has(type)) throw new Error('INVALID_SIGNAL_TYPE');
  return {
    schema_version: 'factory-signal-v1',
    signal_id: 'sig_' + crypto.randomUUID(),
    run_id: requiredString(run.run_id, 'RUN_ID'),
    type,
    payload: payload || {},
    observed_at: now()
  };
}

function rejection(run, reason, evidenceRefs) {
  return {
    schema_version: 'factory-rejection-v1',
    rejection_id: 'rej_' + crypto.randomUUID(),
    run_id: requiredString(run.run_id, 'RUN_ID'),
    reason: requiredString(reason, 'REJECTION_REASON'),
    evidence_refs: Array.isArray(evidenceRefs) ? evidenceRefs : [],
    recorded_at: now()
  };
}

module.exports = {
  normaliseBlueprint,
  instantiate,
  clone,
  startRun,
  recordOutcome,
  signal,
  rejection,
  sha256
};
