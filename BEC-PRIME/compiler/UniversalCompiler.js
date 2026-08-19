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
  return true;
}

function validateKelplantis(spec, source) {
  const g = spec.game;
  assert(g.player && typeof g.player === 'object', `Kelplantis player config missing: ${source}`);
  assert(Number(g.player.speed) > 0, `Kelplantis player speed invalid: ${source}`);
  assert(Number(g.player.maxHealth) > 0, `Kelplantis maxHealth invalid: ${source}`);
  assert(Number(g.player.attackDamage) > 0, `Kelplantis attackDamage invalid: ${source}`);
  assert(g.objective && Number(g.objective.seedCount) > 0, `Kelplantis objective invalid: ${source}`);
  assert(Array.isArray(g.seeds) && g.seeds.length === Number(g.objective.seedCount), `Kelplantis seed count mismatch: ${source}`);
  assert(Array.isArray(g.enemies) && g.enemies.length > 0, `Kelplantis enemies missing: ${source}`);
  for (const seed of g.seeds) assert(Number.isFinite(Number(seed.x)) && Number.isFinite(Number(seed.y)), `Invalid Kelplantis seed: ${source}`);
  for (const enemy of g.enemies) assert(Number(enemy.health) > 0 && Number(enemy.damage) > 0 && Number(enemy.speed) > 0, `Invalid Kelplantis enemy: ${source}`);
}

function shell(spec, body, extra = '') {
  const title = esc(spec.name);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="DreamLedger UniversalCompiler/v2"><title>${title}</title><meta name="description" content="${esc(spec.description)}"><style>body{margin:0;font-family:system-ui,sans-serif;background:#07110b;color:#f5f7fa}main{max-width:1000px;margin:auto;padding:18px}button{font:inherit;padding:10px 14px;border:0;border-radius:8px;cursor:pointer}canvas{display:block;max-width:100%;background:#0b2112;border-radius:12px;box-shadow:0 10px 40px #0008}#hud{display:flex;gap:18px;flex-wrap:wrap;margin:10px 0;font-weight:700}#message{min-height:24px}</style>${extra}</head><body>${body}</body></html>`;
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
  write(path.join(dir, 'sw.js'), `const CACHE='dreamledger-universal-v1';self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./manifest.webmanifest']))));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));\n`);
  return ['index.html', 'manifest.webmanifest', 'sw.js'];
}

function compileBasicGame(spec, dir) {
  const width = Number(spec.game.width || 960);
  const height = Number(spec.game.height || 540);
  const body = `<main><h1>${esc(spec.name)}</h1><p>${esc(spec.description)}</p><canvas id="game" width="${width}" height="${height}" aria-label="${esc(spec.name)} game"></canvas><p id="score">Score: 0</p></main><script>const c=document.getElementById('game'),x=c.getContext('2d'),s=document.getElementById('score');let px=${Math.floor(width/2)},py=${Math.floor(height/2)},score=0;const keys=new Set;addEventListener('keydown',e=>keys.add(e.key));addEventListener('keyup',e=>keys.delete(e.key));function loop(){if(keys.has('ArrowLeft'))px-=4;if(keys.has('ArrowRight'))px+=4;if(keys.has('ArrowUp'))py-=4;if(keys.has('ArrowDown'))py+=4;px=Math.max(10,Math.min(${width-10},px));py=Math.max(10,Math.min(${height-10},py));score++;x.clearRect(0,0,c.width,c.height);x.fillStyle='#4ade80';x.fillRect(px-10,py-10,20,20);s.textContent='Score: '+score;requestAnimationFrame(loop)}loop();</script>`;
  write(path.join(dir, 'index.html'), shell(spec, body));
  return ['index.html'];
}

function compileKelplantis(spec, dir) {
  const g = spec.game;
  const width = Number(g.width);
  const height = Number(g.height);
  const data = JSON.stringify({ player: g.player, objective: g.objective, seeds: g.seeds, enemies: g.enemies });
  const runtime = `const DATA=${data};\nconst c=document.getElementById('game'),ctx=c.getContext('2d'),W=c.width,H=c.height;\nconst p={x:70,y:H-70,r:13,hp:DATA.player.maxHealth,seed:0,score:0,attackAt:0};\nconst seeds=DATA.seeds.map((s,i)=>({x:s.x,y:s.y,taken:false,id:i}));\nconst enemies=DATA.enemies.map((e,i)=>({x:e.x,y:e.y,r:15,hp:e.health,maxHp:e.health,damage:e.damage,speed:e.speed,hitAt:0,id:i,dead:false}));\nconst keys=new Set();let state='play',last=performance.now();\naddEventListener('keydown',e=>{keys.add(e.key.toLowerCase());if(e.key===' '){e.preventDefault();attack()}});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));\nfunction dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}\nfunction attack(){const now=performance.now();if(state!=='play'||now<p.attackAt)return;p.attackAt=now+DATA.player.attackCooldownMs;let best=null,bd=72;for(const e of enemies)if(!e.dead){const d=dist(p,e);if(d<bd){bd=d;best=e}}if(best){best.hp-=DATA.player.attackDamage;p.score+=10;if(best.hp<=0){best.dead=true;p.score+=50}}}\nfunction update(dt){if(state!=='play')return;let dx=0,dy=0;if(keys.has('a')||keys.has('arrowleft'))dx--;if(keys.has('d')||keys.has('arrowright'))dx++;if(keys.has('w')||keys.has('arrowup'))dy--;if(keys.has('s')||keys.has('arrowdown'))dy++;const len=Math.hypot(dx,dy)||1;p.x=Math.max(18,Math.min(W-18,p.x+dx/len*DATA.player.speed*dt));p.y=Math.max(18,Math.min(H-18,p.y+dy/len*DATA.player.speed*dt));\nfor(const s of seeds)if(!s.taken&&dist(p,s)<24){s.taken=true;p.seed++;p.score+=25}\nfor(const e of enemies)if(!e.dead){const d=dist(p,e);if(d>20){e.x+=(p.x-e.x)/Math.max(d,1)*e.speed*dt;e.y+=(p.y-e.y)/Math.max(d,1)*e.speed*dt}else{const now=performance.now();if(now>e.hitAt){e.hitAt=now+700;p.hp-=e.damage;if(p.hp<=0)state='lose'}}}\nif(p.seed>=DATA.objective.seedCount&&dist(p,{x:DATA.objective.sanctuaryX,y:DATA.objective.sanctuaryY})<DATA.objective.sanctuaryRadius)state='win'}\nfunction draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#123b1b';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#2c6b36';for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}\nctx.fillStyle='#8be28b';ctx.beginPath();ctx.arc(DATA.objective.sanctuaryX,DATA.objective.sanctuaryY,DATA.objective.sanctuaryRadius,0,Math.PI*2);ctx.fill();ctx.fillStyle='#14351a';ctx.textAlign='center';ctx.fillText('SANCTUARY',DATA.objective.sanctuaryX,DATA.objective.sanctuaryY+4);\nfor(const s of seeds)if(!s.taken){ctx.fillStyle='#f4df62';ctx.beginPath();ctx.arc(s.x,s.y,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff6a8';ctx.beginPath();ctx.arc(s.x-2,s.y-2,3,0,Math.PI*2);ctx.fill()}\nfor(const e of enemies)if(!e.dead){ctx.fillStyle='#d95757';ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#111';ctx.fillRect(e.x-12,e.y-22,24,4);ctx.fillStyle='#6ee66e';ctx.fillRect(e.x-12,e.y-22,24*Math.max(0,e.hp/e.maxHp),4)}\nctx.fillStyle='#62d8ff';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d9fbff';ctx.stroke();\nif(state!=='play'){ctx.fillStyle='#000b';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff';ctx.font='bold 34px system-ui';ctx.textAlign='center';ctx.fillText(state==='win'?'KELPLANTIS RESTORED':'KELPLANTIS FALLEN',W/2,H/2-12);ctx.font='18px system-ui';ctx.fillText('Refresh to play again',W/2,H/2+24)}}\nfunction frame(now){const dt=Math.min(32,now-last);last=now;update(dt);draw();document.getElementById('hp').textContent=Math.max(0,p.hp);document.getElementById('seeds').textContent=p.seed+'/'+DATA.objective.seedCount;document.getElementById('score').textContent=p.score;requestAnimationFrame(frame)}requestAnimationFrame(frame);`;
  const body = `<main><h1>${esc(spec.name)}</h1><p>${esc(spec.description)}</p><div id="hud"><span>HP: <b id="hp"></b></span><span>Seeds: <b id="seeds"></b></span><span>Score: <b id="score"></b></span><span>Move: WASD/Arrows</span><span>Attack: Space</span></div><canvas id="game" width="${width}" height="${height}" aria-label="Kelplantis MVP game"></canvas><p id="message">Harvest every glow-seed, survive the sprouts, then reach the sanctuary.</p><script>${runtime}</script></main>`;
  write(path.join(dir, 'index.html'), shell(spec, body));
  write(path.join(dir, 'game.json'), JSON.stringify({ id: spec.id, profile: g.profile, width, height, objective: g.objective, seed_count: g.seeds.length, enemy_count: g.enemies.length }, null, 2) + '\n');
  return ['index.html', 'game.json'];
}

function compileGame(spec, dir) {
  if (spec.game.profile === 'kelplantis-mvp') return compileKelplantis(spec, dir);
  return compileBasicGame(spec, dir);
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
  return { id: spec.id, target: spec.target, name: spec.name, profile: spec.game && spec.game.profile || null, files: outputs };
}

function compile() {
  assert(fs.existsSync(SPEC_DIR), `Universal spec directory missing: ${SPEC_DIR}`);
  const files = fs.readdirSync(SPEC_DIR).filter(x => x.endsWith('.json')).sort();
  assert(files.length > 0, 'No universal compiler specs found');
  const results = files.map(file => compileSpec(readJson(path.join(SPEC_DIR, file)), file));
  const proof = {
    schema: 'BEC-PRIME/UNIVERSAL-COMPILER-PROOF/v2',
    status: 'PASS',
    compiler: 'UniversalCompiler/v2',
    targets_supported: Array.from(TARGETS),
    game_profiles_supported: ['basic', 'kelplantis-mvp'],
    specs_compiled: results.length,
    outputs: results,
    native_mobile_binary: false,
    note: 'app target produces a standards-based installable web app/PWA surface; game target produces HTML5 browser games. Native iOS/Android binaries are not claimed.',
    deterministic: true,
    source_hash: sha256(fs.readFileSync(__filename, 'utf8')),
    source_hashes: Object.fromEntries(files.map(file => [file, sha256(fs.readFileSync(path.join(SPEC_DIR, file, ), 'utf8'))]))
  };
  write(PROOF, JSON.stringify(proof, null, 2) + '\n');
  return proof;
}

if (require.main === module) console.log(JSON.stringify(compile(), null, 2));
module.exports = { compile, compileSpec, validateSpec };
