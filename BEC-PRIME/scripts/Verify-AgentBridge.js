'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const target = path.join(ROOT, 'runtime', 'AgentBridge.js');
const doorway = path.join(ROOT, 'routes', 'distributionDoorway.js');
const source = fs.readFileSync(target, 'utf8');
const doorwaySource = fs.readFileSync(doorway, 'utf8');
const checks = [];
function check(name, pass, detail) { checks.push({ name, status: pass ? 'PASS' : 'FAIL', detail: detail || '' }); }

check('agent bridge module exists', fs.existsSync(target));
check('exports handle/configured/recordDoorwaySession', /module\.exports\s*=\s*\{\s*handle\s*,\s*configured\s*,\s*recordDoorwaySession\s*\}/.test(source));
check('manifest endpoint exists', source.includes("/api/agent-bridge/manifest"));
check('state endpoint exists', source.includes("/api/agent-bridge/state"));
check('notes read endpoint exists', source.includes("/api/agent-bridge/notes"));
check('notes write endpoint exists', source.includes("req.method === 'POST' && url === '/api/agent-bridge/notes'"));
check('doorway session recorder exists', source.includes('DOORWAY_SESSION_STARTED') && source.includes("telemetry_events"));
check('state exposes doorway sessions', source.includes('doorway_sessions') && source.includes('DOORWAY_SESSION_STARTED'));
check('doorway imports bridge', doorwaySource.includes("require('../runtime/AgentBridge')"));
check('doorway creates stable session id', doorwaySource.includes('crypto.randomUUID()') && doorwaySource.includes('session_id: sessionId'));
check('doorway persists through bridge', doorwaySource.includes('agentBridge.recordDoorwaySession'));
check('service role stays server-side', source.includes('SUPABASE_SERVICE_ROLE_KEY') && !source.includes('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY'));
check('dedicated bridge token required for agent API', source.includes('DREAMLEDGER_AGENT_BRIDGE_TOKEN'));
check('RA_000001 remains external-payment truth', source.includes('RA_000001 requires independently verified external payment'));
check('canonical doorway is DreamLedger /go', source.includes('https://dreamledger.org/go') || doorwaySource.includes("'/go'"));

let moduleLoad = 'PASS';
try {
  const bridge = require(target);
  check('module loads', typeof bridge.handle === 'function' && typeof bridge.configured === 'function' && typeof bridge.recordDoorwaySession === 'function');
} catch (err) {
  moduleLoad = 'FAIL';
  check('module loads', false, err.message);
}

const failed = checks.filter(x => x.status === 'FAIL');
const result = { schema_version: 'BEC-AGENT-BRIDGE-VERIFY-1.1', status: failed.length ? 'FAIL' : 'PASS', module_load: moduleLoad, checks, checked_at: new Date().toISOString() };
console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exitCode = 1;
