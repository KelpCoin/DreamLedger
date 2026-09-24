'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.join(__dirname,'..');
const SRC=path.join(ROOT,'private','BECK','PEGGY-NAIL-ACADEMY-001.json');
const OUT=path.join(ROOT,'private','compiled','PEGGY-NAIL-ACADEMY-001.html');
function sha256(v){return crypto.createHash('sha256').update(v).digest('hex')}
function esc(v){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
const spec=JSON.parse(fs.readFileSync(SRC,'utf8'));
if(spec.visibility!=='PRIVATE_BECK_ONLY') throw new Error('Private curriculum boundary missing');
if(spec.truth_boundary.truth_oracle_independent!==true) throw new Error('Truth Oracle independence missing');
const modules=spec.modules.map(m=>'<section><h2>Module '+esc(m.id)+': '+esc(m.title)+'</h2><ul>'+m.lessons.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></section>').join('');
const first=spec.first_session;
const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(spec.title)+'</title><style>body{font-family:system-ui,sans-serif;max-width:900px;margin:auto;padding:24px;line-height:1.55}section{padding:12px 0;border-bottom:1px solid #ddd}code{background:#eee;padding:2px 5px}</style></head><body><h1>'+esc(spec.title)+'</h1><p>Private B.E.C.K. curriculum. Not an NZQA qualification or external credential.</p><h2>First session</h2><p>'+esc(first.objective)+'</p><ul>'+first.evidence.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul><h2>Safety gate</h2><p>Stop for pain, bleeding, open skin, suspected infection, significant inflammation, unexplained change, or work outside current training.</p>'+modules+'<h2>Assessment</h2><p>Knowledge target: '+esc(spec.assessment.knowledge_target)+'. '+esc(spec.assessment.safety_rule)+'</p></body></html>';
fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,html);
console.log(JSON.stringify({status:'PASS',source:SRC,output:OUT,source_sha256:sha256(fs.readFileSync(SRC)),output_sha256:sha256(html),modules:spec.modules.length}));
