'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const LOCK = path.join(__dirname, 'mcp-launch.lock.json');
const GATEWAY = path.join(__dirname, 'gateway.js');

function sha256File(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function fail(message) { process.stderr.write('MCP_LAUNCH_BLOCKED: ' + message + '\n'); process.exit(78); }

if (!fs.existsSync(LOCK)) fail('launcher lock missing');
const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
if (lock.gateway_path !== GATEWAY) fail('gateway path mismatch');
if (sha256File(GATEWAY) !== lock.gateway_sha256) fail('gateway integrity mismatch; recompile/reapprove required');
if (lock.launcher_sha256 && sha256File(__filename) !== lock.launcher_sha256) fail('launcher integrity mismatch; recompile/reapprove required');

const child = spawn(process.execPath, [GATEWAY], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: {
    BECKPRIME_ROOT: ROOT,
    BEC_MCP_MODE: 'LOCAL_STDIO_PINNED'
  }
});
process.stdin.pipe(child.stdin);
child.stdout.pipe(process.stdout);
child.on('exit', code => process.exit(code == null ? 1 : code));
child.on('error', err => fail(err.message));
