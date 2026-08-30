'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const checks = [];
function check(id, fn) { try { fn(); checks.push({ id, status: 'PASS' }); } catch (err) { checks.push({ id, status: 'FAIL', error: err.message }); } }

const policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'security', 'mcp-gateway-policy.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'security', 'mcp-gateway-manifest.json'), 'utf8'));
const mirror = JSON.parse(fs.readFileSync(path.join(ROOT, 'compiled', 'security', 'mcp-gateway-manifest.json'), 'utf8'));
const canonical = JSON.stringify({ schema_version: manifest.schema_version, gateway: manifest.gateway, transport: manifest.transport, protocol_version: manifest.protocol_version, tools: manifest.tools }, null, 2) + '\n';
const gateway = fs.readFileSync(path.join(ROOT, 'security', 'gateway.js'), 'utf8');

check('MCP_GATEWAY_PRESENT', () => assert.ok(gateway.includes("require('../gauntlet/GauntletV6')") && gateway.includes("require('../runtime/TruthOracle')") && gateway.includes("require('../runtime/Ledger')")));
check('MCP_TRANSPORT_STDIO_ONLY', () => assert.strictEqual(policy.transport, 'stdio'));
check('MCP_LOCAL_ONLY', () => { assert.strictEqual(policy.network.localhost_only, true); assert.strictEqual(policy.network.allow_any_interface, false); });
check('MCP_NODE_ONLY', () => { assert.deepStrictEqual(policy.execution.allowed_commands, ['node']); assert.strictEqual(policy.execution.command_must_be_absolute_on_host, true); });
check('MCP_NO_PACKAGE_BOOTSTRAP', () => { assert.strictEqual(policy.execution.allow_npx, false); assert.strictEqual(policy.execution.allow_pip_install, false); assert.strictEqual(policy.execution.allow_git_clone, false); });
check('MCP_ZERO_SPEND', () => assert.strictEqual(policy.authority.autonomous_spend_nzd, 0));
check('MCP_NO_MODEL_APPROVAL', () => assert.strictEqual(policy.authority.model_can_approve, false));
check('MCP_NO_MODEL_EXECUTION', () => assert.strictEqual(policy.authority.model_can_execute, false));
check('MCP_NO_PAYMENT_SECRETS', () => assert.strictEqual(policy.authority.model_can_access_payment_credentials, false));
check('MCP_NO_TOKEN_PASSTHROUGH', () => assert.strictEqual(policy.secrets.token_passthrough, false));
check('MCP_NO_ENV_INTERPOLATION', () => { assert.strictEqual(policy.secrets.environment_urls, false); assert.strictEqual(policy.secrets.environment_interpolation, false); });
check('MCP_NO_SHADOWING', () => assert.strictEqual(policy.tools.allow_shadowing, false));
check('MCP_MANIFEST_HASH', () => assert.strictEqual(crypto.createHash('sha256').update(canonical, 'utf8').digest('hex'), manifest.manifest_hash));
check('MCP_COMPILER_MIRROR', () => assert.strictEqual(mirror.manifest_hash, manifest.manifest_hash));
check('MCP_EXACT_TOOLS', () => assert.deepStrictEqual(manifest.tools.map(x => x.name), ['dl_read_cartridge','dl_read_inventory','dl_read_ledger','dl_propose_offer','dl_verify_proof','dl_propose_checkout']));
check('MCP_NO_DANGEROUS_TOOL', () => assert.strictEqual(manifest.tools.some(x => /charge|create_checkout|powershell|delete|shell|exec/i.test(x.name)), false));
check('MCP_COURT_GATE', () => { assert.ok(gateway.includes("gauntletResult.status !== 'PASS'")); assert.ok(gateway.includes("truth.chain_status !== 'PASS'")); assert.ok(gateway.includes("ELIGIBLE_FOR_HUMAN_APPROVAL")); });
check('MCP_NO_EXECUTOR_PATH', () => { assert.ok(!gateway.includes('stripe_secret_key')); assert.ok(!gateway.includes('stripe_webhook_secret')); assert.ok(!gateway.includes('stripe.')); });

const controlPlane = fs.readFileSync(path.join(ROOT, 'runtime', 'ControlPlane.js'), 'utf8');
check('CONTROL_MUTATIONS_AUTHENTICATED', () => { assert.ok(controlPlane.includes('DREAMLEDGER_CONTROL_TOKEN')); assert.ok(controlPlane.includes('rejectMutation(req, send)')); });
const start = fs.readFileSync(path.join(ROOT, 'start.js'), 'utf8');
check('WEB_SECURITY_HEADERS', () => { for (const h of ['X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy']) assert.ok(start.includes(h)); });
check('PRODUCTION_BINDING_EXPLICIT', () => assert.ok(start.includes("capturedServer.listen(PORT,'0.0.0.0'")));

const result = { schema_version: 'BECKPRIME-SECURITY-GATE-1.2', status: checks.every(x => x.status === 'PASS') ? 'PASS' : 'FAIL', checks, checked_at: new Date().toISOString() };
const proofDir = path.join(ROOT, 'data', 'proofs');
fs.mkdirSync(proofDir, { recursive: true });
fs.writeFileSync(path.join(proofDir, 'mcp-security-latest.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(result, null, 2));
process.exit(result.status === 'PASS' ? 0 : 1);
