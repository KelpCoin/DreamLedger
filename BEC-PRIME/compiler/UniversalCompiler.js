'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SPEC_DIR = path.join(ROOT, 'compiler', 'universal-specs');
const OUT_ROOT = path.join(ROOT, 'compiled', 'universal');
const PROOF = path.join(ROOT, 'RUN-PROOFS', 'UNIVERSAL-COMPILER-PROOF.json');
const TARGETS = new Set(['website', 'game', 'app']);
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function write(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text, 'utf8'); }
function esc(value) { return String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c])); }
function assert(condition, message) { if (!condition) throw new Error(message); }

function validateSpec(spec, source) {
  assert(spec && typeof spec === 'object', `Invalid spec: ${source}`);
  assert(typeof spec.id === 'string' && SAFE_ID.test(spec.id), `Invalid id: ${source}`);
  assert(TARGETS.has(spec.target), `Unsupported target: ${spec.target}`);
  assert(typeof spec.name === 'string' && spec.name.trim(), `Missing name: ${source}`);
  assert(typeof spec.description === 'string', `Missing description: ${source}`);
  if (spec.target === 'website') assert(!spec.pages || Array.isArray(spec.pages), `Website pages must be an array: ${source}`);
  if (spec.target === 'app') assert(!spec.features || Array.isArray(spec.features), `App features must be an array: ${source}`);
  if (spec.target === 'game') {
    assert(spec.game && typeof spec.game === 'object', `Game target requires game config: ${source}`);
    assert(Number(spec.game.width || 960) > 0 && Number(spec.game.height || 540) > 0, `Invalid game dimensions: ${source}`);
  }
  return true;
}

function shell(spec, body, extra = '') {
  const title = esc(spec.name);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="DreamLedger UniversalCompiler/v1"><title>${title}</title><meta name="description" content="${esc(spec.description)}"><style>body{margin:0;font-family:system-ui,sans-serif;background:#101216;color:#f5f7fa}main{max-width:1000px;margin:auto;padding:32px}button{font:inherit;padding:10px 14px;border:0;border-radius:8px;cursor:pointer}canvas{display:block;max-width:100%;background:#181b22;border-radius:12px}</style>${extra}</head><body>${body}</body></html>`;
}

function compileWebsite(spec, dir) {
  const body = `<main><h1>${esc(spec.name)}</h1><p>${esc(spec.description)}</p>${(spec.pages || []).map(p => `<section><h2>${esc(p.title || '')}</h2><p>${esc(p.body || '')}</p></section>`).join('')}</main>`;
  write(path.join(dir, 'index.html'), shell(spec, body));
  return ['index.html'];
}

function compileApp(spec, dir) {
  const features = Array.isArray(spec.features) ? spec.features : [];
  const body = `<main><h1>${esc(spec.name)}</h1><p>${esc(spec.description)}</p><div id="app">${features.map((f,i) => `<button data-feature="${i}">${esc(f)}</button>`).join(' ')}</div><p id="status">Ready.</p></main><script>document.querySelectorAll('[data-feature]').forEach(b=>b.onclick=()=>document.getElementById('status').textContent='Selected: '+b.textContent);if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});</script>`;
  write(path.join(dir, 'index.html'), shell(spec, body, '<link rel="manifest" href="./manifest.webmanifest"><meta name="theme-color" content="#101216">'));
  write(path.join(dir, 'manifest.webmanifest'), JSON.stringify({ name: spec.name, short_name: spec.name.slice(0, 24), start_url: './', scope: './', display: 'standalone', background_color: '#101216', theme_color: '#101216', description: spec.description, icons: [] }, null, 2) + '\n');
  write(path.join(dir, 'sw.js'), `const CACHE='dreamledger-universal-v1';self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./manifest.webmanifest']))));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));\n`);
  return ['index.html', 'manifest.webmanifest', 'sw.js'];
}

function compileGame(spec, dir) {
  const width = Number(spec.game.width || 960);
  const height = Number(spec.game.height || 540);
  const body = `<main><h1>${esc(spec.name)}</h1><p>${esc(spec.description)}</p><canvas id="game" width="${width}" height="${height}" aria-label="${esc(spec.name)} game"></canvas><p id="score">Score: 0</p></main><script>const c=document.getElementById('game'),x=c.getContext('2d'),s=document.getElementById('score');let px=${Math.floor(width/2)},py=${Math.floor(height/2)},score=0;const keys=new Set;addEventListener('keydown',e=>keys.add(e.key));addEventListener('keyup',e=>keys.delete(e.key));function loop(){if(keys.has('ArrowLeft'))px-=4;if(keys.has('ArrowRight'))px+=4;if(keys.has('ArrowUp'))py-=4;if(keys.has('ArrowDown'))py+=4;px=Math.max(10,Math.min(${width-10},px));py=Math.max(10,Math.min(${height-10},py));score++;x.clearRect(0,0,c.width,c.height);x.fillStyle='#4ade80';x.fillRect(px-10,py-10,20,20);s.textContent='Score: '+score;requestAnimationFrame(loop)}loop();</script>`;
  write(path.join(dir, 'index.html'), shell(spec, body));
  return ['index.html'];
}

function compileSpec(spec, source) {
  validateSpec(spec, source);
  const dir = path.join(OUT_ROOT, spec.target, spec.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let files;
  if (spec.target === 'website') files = compileWebsite(spec, dir);
  else if (spec.target === 'game') files = compileGame(spec, dir);
  else files = compileApp(spec, dir);
  const outputs = files.map(file => ({ path: path.relative(ROOT, path.join(dir, file)).replace(/\\/g, '/'), sha256: sha256(fs.readFileSync(path.join(dir, file), 'utf8')) }));
  return { id: spec.id, target: spec.target, name: spec.name, files: outputs };
}

function compile() {
  assert(fs.existsSync(SPEC_DIR), `Universal spec directory missing: ${SPEC_DIR}`);
  const files = fs.readdirSync(SPEC_DIR).filter(x => x.endsWith('.json')).sort();
  assert(files.length > 0, 'No universal compiler specs found');
  const results = files.map(file => compileSpec(readJson(path.join(SPEC_DIR, file)), file));
  const proof = {
    schema: 'BEC-PRIME/UNIVERSAL-COMPILER-PROOF/v1',
    status: 'PASS',
    compiler: 'UniversalCompiler/v1',
    targets_supported: Array.from(TARGETS),
    specs_compiled: results.length,
    outputs: results,
    native_mobile_binary: false,
    note: 'app target produces a standards-based installable web app/PWA surface; native iOS/Android binaries require platform toolchains and are not claimed by this compiler.',
    deterministic: true,
    source_hash: sha256(fs.readFileSync(__filename, 'utf8')),
    source_hashes: Object.fromEntries(files.map(file => [file, sha256(fs.readFileSync(path.join(SPEC_DIR, file), 'utf8')])))
  };
  write(PROOF, JSON.stringify(proof, null, 2) + '\n');
  return proof;
}

if (require.main === module) console.log(JSON.stringify(compile(), null, 2));
module.exports = { compile, compileSpec, validateSpec };
