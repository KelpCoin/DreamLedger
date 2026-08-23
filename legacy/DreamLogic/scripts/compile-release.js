const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'release-targets.json'), 'utf8')).targets;
const targetName = process.argv[2] || 'dreamledger';
const target = TARGETS[targetName];
if (!target) throw new Error(`Unknown release target: ${targetName}`);
if (!target.source_root) throw new Error(`${targetName}: source_root is not configured; compilation is intentionally blocked`);

const OUT = path.resolve(ROOT, target.artifact_dir);
const SRC = path.resolve(ROOT, target.source_root);
const keepFiles = [target.entrypoint, 'package.json', 'package-lock.json', 'README.md'];
const keepDirs = ['public', 'assets', 'dreamiez', 'catalog', 'config'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

function copyFile(rel) {
  const src = path.join(SRC, rel);
  if (fs.existsSync(src)) {
    const dst = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}
function copyDir(rel) {
  const src = path.join(SRC, rel);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(OUT, rel), { recursive: true });
}

for (const rel of keepFiles) copyFile(rel);
for (const name of fs.readdirSync(SRC)) if (name.endsWith('.html')) copyFile(name);
for (const rel of keepDirs) copyDir(rel);

const packageJson = JSON.parse(fs.readFileSync(path.join(SRC, 'package.json'), 'utf8'));
const releasePackage = {
  name: `${packageJson.name}-${targetName}`,
  version: packageJson.version,
  private: true,
  description: `${packageJson.description || ''} release artifact for ${target.domain}`.trim(),
  main: target.entrypoint,
  engines: packageJson.engines || { node: '>=20' },
  scripts: { start: packageJson.scripts?.start || `node ${target.entrypoint}` },
  dependencies: packageJson.dependencies || {}
};
fs.writeFileSync(path.join(OUT, 'package.json'), JSON.stringify(releasePackage, null, 2) + '\n');

const sha = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const files = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (name !== 'release-manifest.json') files.push(path.relative(OUT, full).replaceAll('\\', '/'));
  }
}
walk(OUT);
files.sort();
const hashes = files.map(rel => {
  const body = fs.readFileSync(path.join(OUT, rel));
  return { path: rel, bytes: body.length, sha256: crypto.createHash('sha256').update(body).digest('hex') };
});
const manifest = {
  schema_version: 'BEC-RELEASE-1.0',
  status: 'PASS',
  target: targetName,
  domain: target.domain,
  silo: target.silo,
  source_sha: sha,
  built_at_utc: new Date().toISOString(),
  artifact_dir: target.artifact_dir,
  file_count: hashes.length,
  total_bytes: hashes.reduce((n, x) => n + x.bytes, 0),
  files: hashes
};
fs.writeFileSync(path.join(OUT, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
