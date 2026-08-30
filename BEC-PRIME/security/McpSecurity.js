'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const MANIFEST_PATH = path.join(__dirname, 'mcp-tool-manifest.json');
const PIN_PATH = path.join(__dirname, 'mcp-tool-manifest.pin.json');

function canonical(value) {
  return JSON.stringify(value, Object.keys(value || {}).sort(), 0);
}
function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
function canonicalTool(tool) {
  return JSON.stringify({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }, Object.keys(tool.inputSchema || {}).sort(), 0);
}
function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}
function manifestHash(manifest) {
  const tools = [...manifest.tools].sort((a, b) => a.name.localeCompare(b.name));
  return sha256(JSON.stringify(tools.map(t => JSON.parse(canonicalTool(t)))));
}
function verifyToolManifest() {
  const manifest = loadManifest();
  const actual = manifestHash(manifest);
  const pin = JSON.parse(fs.readFileSync(PIN_PATH, 'utf8'));
  const ok = actual === String(pin.sha256 || '').toLowerCase();
  if (!ok) throw new Error(`MCP tool manifest hash mismatch: expected ${pin.sha256}, actual ${actual}`);
  return { status: 'PASS', sha256: actual, tool_count: manifest.tools.length };
}
function rejectEnvExpansion(value) {
  if (/\$\{[^}]+\}/.test(String(value || ''))) throw new Error('Environment-variable expansion is forbidden in MCP configuration values');
  return value;
}
function assertLocalCommand(command) {
  const allowed = new Set(['node', 'node.exe', process.execPath]);
  if (!allowed.has(command)) throw new Error(`MCP command not allowlisted: ${command}`);
  return true;
}
function assertNoShellMeta(value) {
  if (/[;&|`<>]/.test(String(value || ''))) throw new Error('Shell metacharacters are forbidden');
}
function validateCustomerRef(ref) {
  if (!/^CUST-[A-Za-z0-9_-]{6,64}$/.test(String(ref || ''))) throw new Error('customer_ref must be an opaque CUST-* reference');
  return String(ref);
}
function validateSilo(silo) {
  const allowed = new Set(['CORE', 'BILLBOARD', 'MTG', 'INTENT', 'INTELLIGENCE', 'DREAM_MEEZ']);
  const value = String(silo || '').toUpperCase();
  if (!allowed.has(value)) throw new Error(`Unknown silo: ${silo}`);
  return value;
}
function safePath(base, relative) {
  const root = path.resolve(base);
  const candidate = path.resolve(root, String(relative || ''));
  if (candidate !== root && !candidate.startsWith(root + path.sep)) throw new Error('Path escapes allowlisted directory');
  return candidate;
}
function verifyProofShape(proof) {
  if (!proof || typeof proof !== 'object') return { verified: false, reason: 'Invalid proof object' };
  if (!proof.data || proof.hash !== undefined) {
    if (!proof.data || typeof proof.hash !== 'string') return { verified: false, reason: 'Proof requires data and hash' };
  }
  const computed = sha256(JSON.stringify(proof.data));
  return computed === String(proof.hash).toLowerCase()
    ? { verified: true, computed_hash: computed }
    : { verified: false, computed_hash: computed, reason: 'Hash mismatch' };
}

module.exports = {
  ROOT,
  loadManifest,
  manifestHash,
  verifyToolManifest,
  rejectEnvExpansion,
  assertLocalCommand,
  assertNoShellMeta,
  validateCustomerRef,
  validateSilo,
  safePath,
  verifyProofShape
};
