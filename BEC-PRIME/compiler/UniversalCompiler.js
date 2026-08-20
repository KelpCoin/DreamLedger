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
    if (spec.game.profile === 'kelplantis-mvp') validateKelplantis(spec, source);
  }
}

function validateKelplantis(spec, source) {
  const g = spec.game;
  assert(g.world && typeof g.world === 'object', `Kelplantis world config missing: ${source}`);
  assert(String(g.world.worldSeed || '').length > 0, `Kelplantis world seed missing: ${source}`);
  assert(Number.isInteger(Number(g.world.floorId)) && Number(g.world.floorId) >= 1, `Kelplantis floor id invalid: ${source}`);
  assert(String(g.world.bossId || '').length > 0, `Kelplantis boss id missing: ${source}`);
  assert(Number(g.world.roomCount) >= 8, `Kelplantis room count invalid: ${source}`);
  assert(g.town && g.town.safe === true, `Kelplantis safe town missing: ${source}`);
  assert(g.player && Number(g.player.speed) > 0 && Number(g.player.maxHealth) > 0 && Number(g.player.attackDamage) > 0, `Kelplantis player config invalid: ${source}`);
  assert(Array.isArray(g.enemies) && g.enemies.length >= 2, `Kelplantis enemy roster missing: ${source}`);
  for (const enemy of g.enemies) assert(Number(enemy.health) > 0 && Number(enemy.damage) > 0 && Number(enemy.speed) > 0 && Number(enemy.xp) > 0, `Invalid Kelplantis enemy: ${source}`);
  assert(g.loot && Array.isArray(g.loot.items) && g.loot.items.length > 0, `Kelplantis loot table missing: ${source}`);
  assert(g.save && String(g.save.slot || '').length > 0, `Kelplantis save slot missing: ${source}`);
}

function shell(spec, body, extra = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="DreamLedger UniversalCompiler/v3"><title>${esc(spec.name)}</title><meta name="description" content="${esc(spec.description)}"><style>body{margin:0;font-family:system-ui,sans-serif;background:#07110b;color:#f5f7fa}main{max-width:1000px;margin:auto;padding:18px}button{font:inherit;padding:10px 14px;border:0;border-radius:8px;cursor:pointer}canvas{display:block;max-width:100%;background:#0b2112;border-radius:12px;box-shadow:0 10px 40px #0008}#hud{display:flex;gap:18px;flex-wrap:wrap;margin:10px 0;font-weight:700}</style>${extra}</head><body>${body}</body></html>`;
}

function compileWebsite(spec, dir) {
  const body = `<main><h1>${esc(spec.name)}</h1><p>${esc(spec.description)}</p>${(spec.pages || []).map(p => `<section><h2>${esc(p.title || '')}</h2><p>${esc(p.body || '')}</p></section>`).join('')}</main>`;
  write(path.join(dir, 'index.html'), shell(spec, body));
  return ['index.html'];
}

function compileApp(spec, dir) {
  const features = Array.isArray(spec.features) ? spec.features : [];
  const body = `<main><h1>${esc(spec.name)}</h1><p>${esc(spec.description)}</p><div id="app">${features.map((f,i) => `<button data-feature="${i}">${esc(f)}</button>`).join(' ')}</div><p id="status">Ready.</p></main><script>document.querySelectorAll('[data-feature]').forEach(b=>b.onclick=()=>document.getElementById('status').textContent='Selected: '+b.textContent);</script>`;
  write(path.join(dir, 'index.html'), shell(spec, body));
  write(path.join(dir, 'manifest.webmanifest'), JSON.stringify({ name: spec.name, short_name: spec.name.slice(0, 24), start_url: './', scope: './', display: 'standalone', background_color: '#101216', theme_color: '#101216', description: spec.description, icons: [] }, null, 2) + '\n');
  return ['index.html', 'manifest.webmanifest'];
}

function compileBasicGame(spec, dir) {
  const width = Number(spec.game.width || 960), height = Number(spec.game.height || 540);
  const body = `<main><h1>${esc(spec.name)}</h1><p>${esc(spec.description)}</p><canvas id="game" width="${width}" height="${height}"></canvas><p id="score">Score: 0</p></main><script>const c=document.getElementById('game'),x=c.getContext('2d'),s=document.getElementById('score');let px=${Math.floor(width/2)},py=${Math.floor(height/2)},score=0;const keys=new Set;addEventListener('keydown',e=>keys.add(e.key));addEventListener('keyup',e=>keys.delete(e.key));function loop(){if(keys.has('ArrowLeft'))px-=4;if(keys.has('ArrowRight'))px+=4;if(keys.has('ArrowUp'))py-=4;if(keys.has('ArrowDown'))py+=4;px=Math.max(10,Math.min(${width-10},px));py=Math.max(10,Math.min(${height-10},py));score++;x.clearRect(0,0,c.width,c.height);x.fillStyle='#4ade80';x.fillRect(px-10,py-10,20,20);s.textContent='Score: '+score;requestAnimationFrame(loop)}loop();</script>`;
  write(path.join(dir, 'index.html'), shell(spec, body));
  return ['index.html'];
}

function compileKelplantis(spec, dir) {
  const { generateDungeon } = require('./kelplantis/KelplantisDungeonGenerator');
  const { buildRuntimeHtml } = require('./kelplantis/KelplantisRuntime');
  const g = spec.game;
  const dungeon = generateDungeon({ world_seed:g.world.worldSeed, floor_id:g.world.floorId, canonical_boss_id:g.world.bossId, floor_version:g.world.floorVersion, room_count:g.world.roomCount, width:80, height:50 });
  write(path.join(dir, 'index.html'), buildRuntimeHtml(spec, dungeon));
  write(path.join(dir, 'game.json'), JSON.stringify({ id:spec.id, profile:g.profile, dungeon }, null, 2) + '\n');
  return ['index.html', 'game.json'];
}

function compileGame(spec, dir) { return spec.game.profile === 'kelplantis-mvp' ? compileKelplantis(spec, dir) : compileBasicGame(spec, dir); }

function compileSpec(spec, source) {
  validateSpec(spec, source);
  const dir = path.join(OUT_ROOT, spec.target, spec.id);
  fs.rmSync(dir, { recursive:true, force:true });
  fs.mkdirSync(dir, { recursive:true });
  const files = spec.target === 'website' ? compileWebsite(spec, dir) : spec.target === 'game' ? compileGame(spec, dir) : compileApp(spec, dir);
  const outputs = files.map(file => ({ path:path.relative(ROOT, path.join(dir, file)).replace(/\\/g,'/'), sha256:sha256(fs.readFileSync(path.join(dir,file),'utf8')) }));
  return { id:spec.id, target:spec.target, name:spec.name, profile:spec.game && spec.game.profile || null, files:outputs };
}

function compile() {
  assert(fs.existsSync(SPEC_DIR), `Universal spec directory missing: ${SPEC_DIR}`);
  const files = fs.readdirSync(SPEC_DIR).filter(x => x.endsWith('.json')).sort();
  assert(files.length > 0, 'No universal compiler specs found');
  const results = files.map(file => compileSpec(readJson(path.join(SPEC_DIR,file)), file));
  const proof = { schema:'BEC-PRIME/UNIVERSAL-COMPILER-PROOF/v3', status:'PASS', compiler:'UniversalCompiler/v3', targets_supported:Array.from(TARGETS), game_profiles_supported:['basic','kelplantis-mvp'], specs_compiled:results.length, outputs:results, native_windows_binary:false, deterministic:true, source_hash:sha256(fs.readFileSync(__filename,'utf8')), source_hashes:Object.fromEntries(files.map(file => [file,sha256(fs.readFileSync(path.join(SPEC_DIR,file),'utf8'))])) };
  write(PROOF, JSON.stringify(proof,null,2) + '\n');
  return proof;
}

if (require.main === module) console.log(JSON.stringify(compile(), null, 2));
module.exports = { compile, compileSpec, validateSpec };
