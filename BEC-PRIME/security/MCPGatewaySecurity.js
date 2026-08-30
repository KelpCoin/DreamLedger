'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const POLICY = path.join(ROOT, 'security', 'mcp-gateway-policy.json');
const MANIFEST = path.join(ROOT, 'security', 'mcp-gateway-manifest.json');
const MIRROR = path.join(ROOT, 'compiled', 'security', 'mcp-gateway-manifest.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function canonical(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function verify() {
  const checks = [];
  const check = (id, ok, detail) => checks.push({ id, status: ok ? 'PASS' : 'FAIL', detail });

  check('policy.exists', fs.existsSync(POLICY), POLICY);
  check('manifest.exists', fs.existsSync(MANIFEST), MANIFEST);
  check('compiler.mirror.exists', fs.existsSync(MIRROR), MIRROR);
  if (!fs.existsSync(POLICY) || !fs.existsSync(MANIFEST)) {
    return { status: 'FAIL', checks, checked_at: new Date().toISOString() };
  }

  const policy = readJson(POLICY);
  const manifest = readJson(MANIFEST);

  check('transport.stdio_only', manifest.transport === 'stdio' && policy.transport === 'stdio', 'HTTP MCP transport is disabled');
  check('network.local_only', policy.network.localhost_only === true && policy.network.allow_any_interface === false, 'Gateway is local-only');
  check('execution.no_shell', policy.execution.allow_shell === false, 'Shell execution disabled');
  check('execution.no_npx', policy.execution.allow_npx === false, 'npx disabled');
  check('execution.no_install', policy.execution.allow_pip_install === false && policy.execution.allow_git_clone === false, 'Package installation and cloning disabled');
  check('authority.proposal_only', policy.authority.proposal_only === true, 'Model is proposal-only');
  check('authority.zero_spend', policy.authority.autonomous_spend_nzd === 0, 'Autonomous spend is NZD 0');
  check('authority.no_approval', policy.authority.model_can_approve === false, 'Model cannot approve');
  check('authority.no_execution', policy.authority.model_can_execute === false, 'Model cannot execute');
  check('authority.no_payment_secrets', policy.authority.model_can_access_payment_credentials === false, 'Model cannot access payment credentials');
  check('tools.hash_pinning', policy.tools.require_manifest_hash === true && policy.tools.require_description_hash === true, 'Tool hashes required');
  check('tools.no_rug_pull', policy.tools.require_reapproval_on_change === true, 'Tool changes require reapproval');
  check('tools.no_shadowing', policy.tools.allow_shadowing === false, 'Tool shadowing disabled');
  check('sessions.identity_binding', policy.sessions.bind_identity === true, 'Session identity binding required');
  check('sessions.no_shared_state', policy.sessions.shared_state === false, 'Shared session state disabled');
  check('secrets.no_passthrough', policy.secrets.token_passthrough === false, 'Token passthrough disabled');
  check('secrets.no_env_urls', policy.secrets.environment_urls === false && policy.secrets.environment_interpolation === false, 'Environment interpolation disabled');
  check('silos.isolated', policy.silos.cross_silo_access === false, 'Cross-silo access disabled');

  const manifestBody = { schema_version: manifest.schema_version, gateway: manifest.gateway, transport: manifest.transport, protocol_version: manifest.protocol_version, tools: manifest.tools };
  const recomputed = sha256(JSON.stringify(manifestBody, null, 2) + '\n');
  check('manifest.self_hash', recomputed === manifest.manifest_hash, 'Manifest hash recomputes exactly');

  if (fs.existsSync(MIRROR)) {
    const mirror = readJson(MIRROR);
    check('compiler.mirror_match', mirror.manifest_hash === manifest.manifest_hash, 'Compiler mirror matches source manifest');
  }

  const requiredTools = ['dl_read_cartridge', 'dl_read_inventory', 'dl_read_ledger', 'dl_propose_offer', 'dl_verify_proof', 'dl_propose_checkout'];
  const names = Array.isArray(manifest.tools) ? manifest.tools.map(t => t.name) : [];
  check('tools.exact_allowlist', names.length === requiredTools.length && requiredTools.every(x => names.includes(x)), 'Exactly six approved gateway tools');
  check('tools.no_dangerous', !names.some(x => /charge|create_checkout|powershell|delete|publish_publicly|shell|exec/i.test(x)), 'No execution or public-posting tools');

  return { status: checks.every(x => x.status === 'PASS') ? 'PASS' : 'FAIL', checks, manifest_hash: manifest.manifest_hash, checked_at: new Date().toISOString() };
}

module.exports = { verify, sha256 };
