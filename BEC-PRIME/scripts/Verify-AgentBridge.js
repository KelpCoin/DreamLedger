'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const target = path.join(ROOT, 'runtime', 'AgentBridge.js');
const source = fs.readFileSync(target, 'utf8');
const checks = [];
function check(name, pass, detail) { checks.push({ name, status: pass ? 'PASS' : 'FAIL', detail: detail || '' }); }

check('agent bridge module exists', fs.existsSync(target));
check('exports handle', /module\.exports\s*=\s*\{\s*handle\s*,\s*configured\s*\}/.test(source));
check('manifest endpoint exists', source.includes("/api/agent-bridge/manifest"));
check('state endpoint exists', source.includes("/api/agent-bridge/state"));
check('notes read endpoint exists', source.includes("/api/agent-bridge/notes"));
check('notes write endpoint exists', source.includes("req.method === 'POST' && url === '/api/agent-bridge/notes'"));
check('service role stays server-side', source.includes('SUPABASE_SERVICE_ROLE_KEY') && !source.includes('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY'));
check('dedicated bridge token required', source.includes('DREAMLEDGER_AGENT_BRIDGE_TOKEN'));
check('RA_000001 remains external-payment truth', source.includes('RA_000001 requires independently verified external payment'));
check('canonical doorway is DreamLedger /go', source.includes('https://dreamledger.org/go'));

let moduleLoad = 'PASS';
try { const bridge = require(target); check('module loads', typeof bridge.handle === 'function' && typeof bridge.configured === 'function'); }
catch (err) { moduleLoad = 'FAIL'; check('module loads', false, err.message); }

const failed = checks.filter(x => x.status === 'FAIL');
const result = { schema_version: 'BEC-AGENT-BRIDGE-VERIFY-1.0', status: failed.length ? 'FAIL' : 'PASS', module_load: moduleLoad, checks, checked_at: new Date().toISOString() };
console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exitCode = 1;
