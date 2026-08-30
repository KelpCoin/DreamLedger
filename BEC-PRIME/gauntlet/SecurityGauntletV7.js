'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const security = require('../security/McpSecurity');
const gateway = require('../mcp/DreamLedgerGatewayV2');

const ROOT = path.join(__dirname, '..');
const PROOF = path.join(ROOT, 'data', 'proofs', 'SECURITY-GAUNTLET-V7-LATEST.json');
function pass(checks, id, detail) { checks.push({ id, status: 'PASS', detail }); }
function fail(checks, id, detail) { checks.push({ id, status: 'FAIL', detail }); }
function runGateway(requests) {
  const input = requests.map(x => JSON.stringify(x)).join('\n') + '\n';
  const child = spawnSync(process.execPath, [path.join(__dirname, '..', 'mcp', 'DreamLedgerGatewayV2.js')], { cwd: ROOT, input, encoding: 'utf8', timeout: 5000, env: { ...process.env, ELOHIM_V7_LM_STUDIO: 'false' } });
  if (child.error) throw child.error;
  if (child.status !== 0) throw new Error(`Gateway exited ${child.status}: ${child.stderr || ''}`);
  const lines = String(child.stdout || '').split(/\r?\n/).filter(Boolean);
  return lines.map(x => JSON.parse(x));
}
function run() {
  const checks = [];
  try { const m = security.verifyToolManifest(); pass(checks, 'T008', `Pinned manifest ${m.sha256}`); } catch (e) { fail(checks, 'T008', e.message); }
  try {
    const responses = runGateway([
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } } },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'dl_propose_checkout', arguments: { silo: 'MTG', checkout: { sku: 'EDH_0001', amount: 400, currency: 'NZD', customer_ref: 'someone@example.com' } } } },
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'dl_propose_checkout', arguments: { silo: 'MTG', checkout: { sku: 'EDH_0001', amount: 400, currency: 'NZD', customer_ref: 'CUST-test_01' } } } },
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'dl_read_cartridge', arguments: { sku: 'EDH_0001', silo: 'BILLBOARD' } } },
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'dl_create_checkout', arguments: {} } }
    ]);
    const init = responses.find(x => x.id === 1);
    if (init.result?.capabilities?.tools) pass(checks, 'MCP_INIT', 'Legacy compatibility handshake works'); else fail(checks, 'MCP_INIT', 'initialize response missing tools capability');
    const list = responses.find(x => x.id === 2);
    const names = (list.result?.tools || []).map(x => x.name).sort();
    const expected = ['dl_propose_checkout','dl_propose_offer','dl_read_cartridge','dl_read_inventory','dl_read_ledger','dl_verify_proof'].sort();
    if (JSON.stringify(names) === JSON.stringify(expected)) pass(checks, 'T008', 'Exactly six allowlisted tools registered'); else fail(checks, 'T008', `Unexpected tools: ${names.join(',')}`);
    const dangerous = names.filter(n => /create_checkout|charge_customer|execute|delete_file|post_publicly|powershell/i.test(n));
    if (!dangerous.length) pass(checks, 'T008B', 'No dangerous tools registered'); else fail(checks, 'T008B', dangerous.join(','));
    const bad = responses.find(x => x.id === 3);
    if (bad.result?.isError === true) pass(checks, 'T009', 'Malformed customer_ref rejected at runtime'); else fail(checks, 'T009', 'Malformed customer_ref was accepted');
    const blocked = responses.find(x => x.id === 4);
    const data = JSON.parse(blocked.result?.content?.[0]?.text || '{}');
    if (data.state === 'AWAITING_HUMAN_APPROVAL' && data.execution === 'BLOCKED_UNTIL_HUMAN_APPROVAL' && data.stripe_session_created === false) pass(checks, 'T001', 'Checkout is proposal-only and cannot spend'); else fail(checks, 'T001', JSON.stringify(data));
    const cross = responses.find(x => x.id === 5);
    if (cross.result?.isError === true) pass(checks, 'T005', 'Cross-silo read rejected'); else fail(checks, 'T005', 'Cross-silo read accepted');
    const unknown = responses.find(x => x.id === 6);
    if (unknown.error?.code === -32602) pass(checks, 'T008C', 'Unknown dangerous tool rejected with InvalidParams'); else fail(checks, 'T008C', JSON.stringify(unknown));
  } catch (e) { fail(checks, 'MCP_RUNTIME', e.message); }
  try {
    const data = { proof: 'ok', value: 1 };
    const good = { data, hash: crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex') };
    const bad = { data: { proof: 'tampered', value: 1 }, hash: good.hash };
    const vg = security.verifyProofShape(good), vb = security.verifyProofShape(bad);
    if (vg.verified && !vb.verified) pass(checks, 'T007', 'Proof verifier accepts valid hash and rejects tampering'); else fail(checks, 'T007', JSON.stringify({ vg, vb }));
  } catch (e) { fail(checks, 'T007', e.message); }
  try { const chain = gateway.verifyLedger(); if (chain.status === 'PASS') pass(checks, 'T006', `Ledger chain verified: ${chain.count} events`); else fail(checks, 'T006', JSON.stringify(chain)); } catch (e) { fail(checks, 'T006', e.message); }
  try { security.assertLocalCommand('node'); let rejected = false; try { security.assertLocalCommand('powershell'); } catch { rejected = true; } if (rejected) pass(checks, 'MCP_STDIO_COMMAND_PIN', 'Only node command is allowlisted'); else fail(checks, 'MCP_STDIO_COMMAND_PIN', 'Untrusted command accepted'); } catch (e) { fail(checks, 'MCP_STDIO_COMMAND_PIN', e.message); }
  const status = checks.every(x => x.status === 'PASS') ? 'PASS' : 'FAIL';
  const payload = { type: 'beckprime-security-gauntlet', version: '7.0', status, checked_at: new Date().toISOString(), checks, production_authority: 'HUMAN_APPROVAL_ONLY' };
  fs.mkdirSync(path.dirname(PROOF), { recursive: true });
  fs.writeFileSync(PROOF, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return payload;
}
if (require.main === module) { const result = run(); console.log(JSON.stringify(result, null, 2)); process.exit(result.status === 'PASS' ? 0 : 1); }
module.exports = { run };
