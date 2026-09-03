'use strict';

const crypto = require('crypto');

const STAGES = Object.freeze([
  'INPUT_SIGNAL',
  'ROUTER',
  'EXECUTION',
  'STRUCTURING',
  'VALIDATION',
  'OUTPUT',
  'FEEDBACK'
]);

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}

function sha256(value) {
  return crypto.createHash('sha256').update(canonical(value), 'utf8').digest('hex');
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
}

function inputSignal(signal) {
  requireObject(signal, 'signal');
  if (!signal.signal_id) throw new Error('SIGNAL_ID_REQUIRED');
  if (!signal.source) throw new Error('SIGNAL_SOURCE_REQUIRED');
  return { stage: 'INPUT_SIGNAL', status: 'PASS', signal: { ...signal } };
}

function route(signal, routes = []) {
  const candidates = Array.isArray(routes) ? routes : [];
  const matched = candidates.filter(r => r && r.enabled !== false && (!r.source || r.source === signal.source) && (!r.intent || r.intent === signal.intent));
  return { stage: 'ROUTER', status: matched.length ? 'PASS' : 'NO_ROUTE', routes: matched };
}

function execute(signal, routeResult, proposal) {
  requireObject(proposal, 'proposal');
  if (routeResult.status !== 'PASS') return { stage: 'EXECUTION', status: 'BLOCKED', reason: 'NO_ROUTE', proposal: null };
  return {
    stage: 'EXECUTION',
    status: 'PROPOSAL_ONLY',
    proposal: { ...proposal, signal_id: signal.signal_id },
    execution_allowed: false
  };
}

function structure(signal, execution) {
  return {
    stage: 'STRUCTURING',
    status: execution.status === 'PROPOSAL_ONLY' ? 'PASS' : 'BLOCKED',
    cartridge: execution.status === 'PROPOSAL_ONLY' ? {
      schema: 'dreamledger.revenue-cartridge.v1',
      signal_id: signal.signal_id,
      source: signal.source,
      proposal: execution.proposal
    } : null
  };
}

function validate(cartridge, gauntlet = {}) {
  const checks = {
    has_signal: Boolean(cartridge && cartridge.signal_id),
    has_source: Boolean(cartridge && cartridge.source),
    has_proposal: Boolean(cartridge && cartridge.proposal),
    gauntlet_pass: gauntlet.status === 'PASS'
  };
  const passed = Object.values(checks).every(Boolean);
  return { stage: 'VALIDATION', status: passed ? 'PASS' : 'FAIL', checks, gauntlet: gauntlet.status || 'UNKNOWN' };
}

function output(cartridge, validation) {
  if (validation.status !== 'PASS') return { stage: 'OUTPUT', status: 'QUARANTINED', cartridge: null };
  return { stage: 'OUTPUT', status: 'STAGED', cartridge, immutable_id: 'rc_' + sha256(cartridge).slice(0, 24) };
}

function feedback(result, metrics = {}) {
  requireObject(metrics, 'metrics');
  return {
    stage: 'FEEDBACK',
    status: 'RECORDED',
    metrics: { ...metrics },
    result_status: result.status
  };
}

function run({ signal, routes, proposal, gauntlet, metrics = {} }) {
  const input = inputSignal(signal);
  const routed = route(signal, routes);
  const executed = execute(signal, routed, proposal);
  const structured = structure(signal, executed);
  const validation = structured.status === 'PASS' ? validate(structured.cartridge, gauntlet) : { stage: 'VALIDATION', status: 'FAIL', checks: {}, reason: 'STRUCTURING_BLOCKED' };
  const result = output(structured.cartridge, validation);
  const fb = feedback(result, metrics);
  const stages = [input, routed, executed, structured, validation, result, fb];
  return {
    schema: 'dreamledger.revenue-pipeline.v1',
    status: result.status === 'STAGED' ? 'PASS' : 'QUARANTINE',
    stages,
    pipeline_hash: sha256(stages)
  };
}

module.exports = { STAGES, canonical, sha256, inputSignal, route, execute, structure, validate, output, feedback, run };
