'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GATEWAY = path.join(ROOT, 'security', 'gateway.js');
const MANIFEST = path.join(ROOT, 'security', 'mcp-gateway-manifest.json');
const POLICY = path.join(ROOT, 'security', 'mcp-gateway-policy.json');
const MIRROR = path.join(ROOT, 'compiled', 'security', 'mcp-gateway-manifest.json');
const PROOF = path.join(ROOT, 'data', 'proofs', 'mcp-gateway-verification-latest.json');
const checks = [];
function check(name, ok, detail) { checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail }); console.log(`${ok ? 'PASS' : 'FAIL'}: ${name} - ${detail}`); }
function canonical(m) { return JSON.stringify({schema_version:m.schema_version,gateway:m.gateway,transport:m.transport,protocol_version:m.protocol_version,tools:m.tools},null,2)+'\n'; }

check('FILES_GATEWAY', fs.existsSync(GATEWAY), GATEWAY);
check('FILES_MANIFEST', fs.existsSync(MANIFEST), MANIFEST);
check('FILES_POLICY', fs.existsSync(POLICY), POLICY);
check('FILES_MIRROR', fs.existsSync(MIRROR), MIRROR);
const manifest = JSON.parse(fs.readFileSync(MANIFEST,'utf8'));
const policy = JSON.parse(fs.readFileSync(POLICY,'utf8'));
const mirror = JSON.parse(fs.readFileSync(MIRROR,'utf8'));
check('MANIFEST_HASH', crypto.createHash('sha256').update(canonical(manifest)).digest('hex') === manifest.manifest_hash, 'SHA-256 recomputation');
check('MIRROR_HASH', mirror.manifest_hash === manifest.manifest_hash, 'Compiler mirror matches');
check('POLICY_NODE_ONLY', policy.execution.allowed_commands.length === 1 && policy.execution.allowed_commands[0] === 'node' && policy.execution.command_must_be_absolute_on_host === true, 'Node command pinned');
check('POLICY_ZERO_SPEND', policy.authority.autonomous_spend_nzd === 0, 'NZD 0');
check('POLICY_NO_EXEC', policy.authority.model_can_execute === false, 'model execution denied');
check('POLICY_NO_APPROVAL', policy.authority.model_can_approve === false, 'model approval denied');
check('POLICY_NO_TOKEN_PASSTHROUGH', policy.secrets.token_passthrough === false, 'token passthrough denied');
check('POLICY_NO_ENV_INTERPOLATION', policy.secrets.environment_interpolation === false, 'environment interpolation denied');
check('POLICY_NO_SHADOWING', policy.tools.allow_shadowing === false, 'tool shadowing denied');
check('TOOLS_EXACT', manifest.tools.map(x=>x.name).join('|') === 'dl_read_cartridge|dl_read_inventory|dl_read_ledger|dl_propose_offer|dl_verify_proof|dl_propose_checkout', 'exact six-tool allowlist');

const child = spawn(process.execPath, [GATEWAY], {cwd:ROOT, env:{...process.env, BEC_LEDGER_DIR:path.join(ROOT,'data','proofs','mcp-test-ledger')}, stdio:['pipe','pipe','pipe']});
let buffer = '';
let pending = [];
function rpc(req) { return new Promise((resolve,reject)=>{ pending.push({resolve,reject}); child.stdin.write(JSON.stringify(req)+'\n'); }); }
child.stdout.on('data',chunk=>{ buffer += chunk.toString(); let idx; while((idx=buffer.indexOf('\n'))>=0){ const line=buffer.slice(0,idx); buffer=buffer.slice(idx+1); if(!line.trim()) continue; const item=pending.shift(); if(item) item.resolve(JSON.parse(line)); }});
(async()=>{
  try {
    let r = await rpc({jsonrpc:'2.0',id:1,method:'tools/list',params:{}}); check('LIFECYCLE_REJECT_BEFORE_INIT', r.error && r.error.code === -32002, 'initialize required');
    r = await rpc({jsonrpc:'2.0',id:2,method:'initialize',params:{protocolVersion:'2025-11-25',clientInfo:{name:'behavioural-verifier',version:'1'}}}); check('INITIALIZE', r.result && r.result.protocolVersion === '2025-11-25', 'protocol negotiated');
    r = await rpc({jsonrpc:'2.0',id:3,method:'initialized',params:{}}); check('INITIALIZED', !r.error, 'initialized accepted');
    r = await rpc({jsonrpc:'2.0',id:4,method:'tools/list',params:{}}); check('TOOLS_LIST', Array.isArray(r.result && r.result.tools) && r.result.tools.length === 6, 'six tools exposed after handshake');
    r = await rpc({jsonrpc:'2.0',id:5,method:'tools/call',params:{name:'dl_propose_checkout',arguments:{checkout:{sku:'EDH_0001',amount:400,customer_ref:'CUST-TEST-001'},silo:'MTG'}}});
    if (r.result && r.result.content) {
      const payload = JSON.parse(r.result.content[0].text);
      const authority = payload.capital_authority || (payload.court && payload.court.capital_authority);
      const ok = payload.status === 'AWAITING_HUMAN_APPROVAL' &&
        payload.execution === 'BLOCKED' &&
        payload.executed === false &&
        authority === 'ZERO' &&
        payload.court &&
        payload.court.decision === 'ELIGIBLE_FOR_HUMAN_APPROVAL' &&
        payload.court.gauntlet === 'PASS' &&
        payload.court.truth === 'PASS';
      check('COURT_GAUNTLET_TRUTH_PATH', ok, 'Gauntlet PASS -> Truth Oracle PASS -> Court eligibility -> human approval');
    } else check('COURT_GAUNTLET_TRUTH_PATH', false, JSON.stringify(r));
    r = await rpc({jsonrpc:'2.0',id:6,method:'tools/call',params:{name:'dl_execute_powershell',arguments:{command:'whoami'}}}); check('DANGEROUS_TOOL_REJECTED', r.error && r.error.code === -32000, 'unknown execution tool rejected');
  } catch (err) { check('BEHAVIOURAL_HARNESS', false, err.message); }
  child.kill();
  const result = {schema_version:'BECKPRIME-MCP-VERIFICATION-1.2',status:checks.every(x=>x.status==='PASS')?'PASS':'FAIL',checks,checked_at:new Date().toISOString()};
  fs.mkdirSync(path.dirname(PROOF),{recursive:true}); fs.writeFileSync(PROOF,JSON.stringify(result,null,2)+'\n','utf8'); console.log(JSON.stringify(result,null,2)); process.exit(result.status==='PASS'?0:1);
})();
