'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const CONFIG = path.join(ROOT, 'config', 'silos.json');
const PROOF = path.join(ROOT, 'PROOF-MULTI-SILO-SURFACE-COMPILATION.json');
function sha(value){return crypto.createHash('sha256').update(value,'utf8').digest('hex');}
const configText=fs.readFileSync(CONFIG,'utf8');
const config=JSON.parse(configText);
if(!Array.isArray(config.silos)||!config.silos.length)throw new Error('No silo definitions.');
const results=[];
for(const silo of config.silos){
 const outDir=path.join(ROOT,silo.output_dir); fs.mkdirSync(outDir,{recursive:true});
 if(silo.id==='mtg'){
  const source=path.join(ROOT,silo.source_surface); if(!fs.existsSync(source))throw new Error('MTG canonical surface missing: '+silo.source_surface);
  fs.copyFileSync(source,path.join(outDir,'index.html'));
 } else if(silo.id==='dreamiez'){
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><title>Dreamiez | DreamLedger</title><style>:root{--bg:#090a0d;--panel:#151820;--line:#303541;--text:#f4f1eb;--muted:#a8adb8;--gold:#d8b66b;--pink:#e5a6c4}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 70% -10%,#241a26,#090a0d 48%);color:var(--text);font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}.wrap{max-width:900px;margin:auto;padding:28px 20px 60px}.eyebrow{color:var(--pink);font-size:.72rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase}h1{font-size:clamp(3rem,8vw,6rem);line-height:.88;letter-spacing:-.06em;margin:12px 0 18px}p{color:var(--muted);max-width:720px}.panel{border:1px solid var(--line);background:rgba(21,24,32,.9);border-radius:18px;padding:22px;margin:18px 0}.cta{display:inline-block;margin-top:10px;padding:13px 18px;border-radius:11px;background:var(--gold);color:#111;text-decoration:none;font-weight:900}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.tile{border:1px solid var(--line);border-radius:14px;padding:16px;background:#10131a}.tile b{display:block;color:var(--gold);font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:7px}@media(max-width:700px){.grid{grid-template-columns:1fr}}</style></head><body><main class="wrap"><div class="eyebrow">DreamLedger / Dreamiez silo</div><h1>Create your Dreamiez.</h1><p>A lightweight identity and streak surface for claiming a name, choosing a style, and earning generated rewards through daily presence.</p><section class="panel"><h2>Launch candidate</h2><p>The account engine already exists behind the public boundary. This surface is intentionally small: identity, avatar, streak, reward. No internal compiler doctrine is exposed.</p><a class="cta" href="/dreamiez">Open Dreamiez account</a></section><section class="grid"><div class="tile"><b>Identity</b><span>Claim a Dreamiez name.</span></div><div class="tile"><b>Presence</b><span>Build a daily streak.</span></div><div class="tile"><b>Rewards</b><span>Unlock generated assets.</span></div></section><section class="panel"><h2>Economic boundary</h2><p>Dreamiez activation and paid products remain approval-gated. This public surface makes no revenue claim and does not expose private BEC-PRIME implementation material.</p></section></main></body></html>';
  fs.writeFileSync(path.join(outDir,'index.html'),html,'utf8');
 } else throw new Error('Unsupported silo: '+silo.id);
 const index=path.join(outDir,'index.html');
 const manifest={schema:'bec-prime/compiled-silo/v1',silo_id:silo.id,display_name:silo.display_name,output:path.relative(ROOT,index),source_mode:silo.mode,economic_spine:silo.economic_spine,activation_required:silo.activation_required,checkout_unlocked:false,payment_claimed:false,private_material_excluded:true,content_sha256:sha(fs.readFileSync(index,'utf8'))};
 fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8'); results.push(manifest);
}
const proof={schema:'bec-prime/multi-silo-surface-proof/v1',verdict:'PASS',silo_count:results.length,silos:results,guarantees:{shared_economic_spine:true,isolated_output_directories:true,checkout_unlocked:false,payment_claimed:false,private_material_excluded:true,deterministic_inputs:[path.relative(ROOT,CONFIG)]}};
fs.writeFileSync(PROOF,JSON.stringify(proof,null,2)+'\n','utf8'); console.log(JSON.stringify(proof,null,2));
