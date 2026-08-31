'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const PROOF_DIR = path.join(ROOT, 'RUN-PROOFS');
const UNIVERSAL = path.join(ROOT, 'compiler', 'UniversalCompiler.js');
const SPEC_DIR = path.join(ROOT, 'compiler', 'universal-specs');
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
  console.log(`BEC local control plane\n\nUsage:\n  bec compile                         Compile all existing BEC targets\n  bec compile website [id]            Compile universal website target(s)\n  bec compile game [id]               Compile universal game target(s)\n  bec compile app [id]                Compile universal app target(s)\n  bec website [id]                    Compile universal website target(s)\n  bec game [id]                       Compile universal game target(s)\n  bec app [id]                        Compile universal app target(s)\n  bec verify                          Run compiler + commercial verification\n  bec status                          Print available compiler surfaces\n\nNo external AI or service is required for compilation.`);
}

function loadCompiler() {
  if (!fs.existsSync(UNIVERSAL)) throw new Error('UniversalCompiler.js not found');
  return require(UNIVERSAL);
}

function readSpecs() {
  if (!fs.existsSync(SPEC_DIR)) throw new Error('Universal spec directory not found: ' + SPEC_DIR);
  return fs.readdirSync(SPEC_DIR).filter(x => x.endsWith('.json')).sort().map(file => ({ file, spec: JSON.parse(fs.readFileSync(path.join(SPEC_DIR, file), 'utf8')) }));
}

function selectSpecs(target, requestedId) {
  const rows = readSpecs().filter(x => !target || x.spec.target === target);
  if (!requestedId) return rows;
  const needle = requestedId.toLowerCase();
  const exact = rows.find(x => x.spec.id.toLowerCase() === needle || x.file.toLowerCase().replace(/\.json$/,'') === needle);
  if (exact) return [exact];
  const fuzzy = rows.filter(x => [x.spec.id, x.spec.name, x.spec.description].some(v => String(v || '').toLowerCase().includes(needle)));
  if (fuzzy.length) return fuzzy;
  throw new Error('No universal compiler spec matched: ' + requestedId + ' (target=' + (target || 'any') + ')');
}

function status() {
  const compiler = loadCompiler();
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE, 'utf8'));
  const specs = readSpecs();
  console.log(JSON.stringify({
    status: 'READY',
    entrypoint: 'BEC-PRIME/bec.cmd',
    compiler: 'BEC-PRIME/compiler/UniversalCompiler.js',
    targets: ['website', 'game', 'app'],
    game_profiles: ['basic', 'kelplantis-mvp'],
    universal_specs: specs.map(x => ({ id: x.spec.id, target: x.spec.target, name: x.spec.name })),
    npm_compile: Boolean(packageJson.scripts && packageJson.scripts.compile),
    proof: 'BEC-PRIME/RUN-PROOFS/UNIVERSAL-COMPILER-PROOF.json'
  }, null, 2));
  void compiler;
}

function compileSelected(target, requestedId) {
  const compiler = loadCompiler();
  const selected = selectSpecs(target, requestedId);
  const results = selected.map(x => compiler.compileSpec(x.spec, x.file));
  if (results.some(x => !x || x.target !== target)) throw new Error('Selected compile returned unexpected target.');
  console.log(JSON.stringify({ status: 'PASS', command: 'compile', target, selector: requestedId || null, compiled: results }, null, 2));
  return results;
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
    schema: 'BEC-PRIME/CONTROL-PLANE-PROOF/v2',
    status: 'PASS',
    generated_at: new Date().toISOString(),
    entrypoint: 'BEC-PRIME/bec.cmd',
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

const args = process.argv.slice(2);
const command = (args[0] || 'status').toLowerCase();
try {
  if (command === 'status') status();
  else if (command === 'compile') {
    if (!args[1]) runNpm('compile');
    else {
      const target = args[1].toLowerCase();
      if (!['website','game','app'].includes(target)) throw new Error('Compile target must be website, game, or app.');
      compileSelected(target, args[2] || null);
    }
  }
  else if (command === 'website' || command === 'game' || command === 'app') compileSelected(command, args[1] || null);
  else if (command === 'verify') verify();
  else { usage(); die('Unknown command: ' + command, 2); }
} catch (err) {
  die(err && err.stack ? err.stack : String(err));
}
