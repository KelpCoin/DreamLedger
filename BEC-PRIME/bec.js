'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const PROOF_DIR = path.join(ROOT, 'RUN-PROOFS');
const UNIVERSAL = path.join(ROOT, 'compiler', 'UniversalCompiler.js');
const PACKAGE = path.join(ROOT, 'package.json');

function die(message, code = 1) {
  console.error('[BEC] ' + message);
  process.exitCode = code;
}

function runNode(file, args = []) {
  const r = spawnSync(process.execPath, [file, ...args], { cwd: ROOT, stdio: 'inherit' });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(path.relative(ROOT, file) + ' exited ' + r.status);
}

function runNpm(script) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = spawnSync(npm, ['run', script], { cwd: ROOT, stdio: 'inherit' });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error('npm run ' + script + ' exited ' + r.status);
}

function usage() {
  console.log(`BEC local control plane\n\nUsage:\n  node bec.js compile              Compile all existing BEC targets\n  node bec.js website              Compile universal website targets\n  node bec.js game                 Compile universal game targets\n  node bec.js app                  Compile universal app targets\n  node bec.js verify               Run compiler + commercial verification\n  node bec.js status               Print available compiler surfaces\n\nNo external AI or service is required for compilation.`);
}

function loadCompiler() {
  if (!fs.existsSync(UNIVERSAL)) throw new Error('UniversalCompiler.js not found');
  return require(UNIVERSAL);
}

function status() {
  const compiler = loadCompiler();
  const specsDir = path.join(ROOT, 'compiler', 'universal-specs');
  const specs = fs.existsSync(specsDir) ? fs.readdirSync(specsDir).filter(x => x.endsWith('.json')).sort() : [];
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE, 'utf8'));
  console.log(JSON.stringify({
    status: 'READY',
    entrypoint: 'BEC-PRIME/bec.js',
    compiler: 'BEC-PRIME/compiler/UniversalCompiler.js',
    targets: ['website', 'game', 'app'],
    game_profiles: ['basic', 'kelplantis-mvp'],
    universal_specs: specs,
    npm_compile: Boolean(packageJson.scripts && packageJson.scripts.compile),
    proof: 'BEC-PRIME/RUN-PROOFS/UNIVERSAL-COMPILER-PROOF.json'
  }, null, 2));
  void compiler;
}

function compileUniversal() {
  const compiler = loadCompiler();
  const result = compiler.compile();
  if (!result || result.status !== 'PASS') throw new Error('Universal compiler did not PASS');
  return result;
}

function verify() {
  const result = compileUniversal();
  runNpm('verify:production-contract');
  runNpm('verify:mcp-security');
  runNpm('verify:mcp');
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  const proof = {
    schema: 'BEC-PRIME/CONTROL-PLANE-PROOF/v1',
    status: 'PASS',
    generated_at: new Date().toISOString(),
    entrypoint: 'BEC-PRIME/bec.js',
    compiler: result.compiler,
    targets: result.targets_supported,
    specs_compiled: result.specs_compiled,
    verification: ['verify:production-contract', 'verify:mcp-security', 'verify:mcp'],
    universal_proof: 'RUN-PROOFS/UNIVERSAL-COMPILER-PROOF.json'
  };
  const out = path.join(PROOF_DIR, 'BEC-CONTROL-PLANE-LATEST.json');
  fs.writeFileSync(out, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log('[BEC] CONTROL PLANE PASS: ' + out);
}

const command = (process.argv[2] || 'status').toLowerCase();
try {
  if (command === 'status') status();
  else if (command === 'compile') runNpm('compile');
  else if (command === 'website' || command === 'game' || command === 'app') compileUniversal();
  else if (command === 'verify') verify();
  else { usage(); die('Unknown command: ' + command, 2); }
} catch (err) {
  die(err && err.stack ? err.stack : String(err));
}
