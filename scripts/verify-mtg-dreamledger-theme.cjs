'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');const checks=[];const check=(name,pass)=>checks.push({name,status:pass?'PASS':'FAIL'});
const shared=read('public/assets/bec-neon.css'),theme=read('public/assets/mtg-dreamledger-theme.css');
check('homepage_loads_shared_theme',read('public/index.html').includes('/assets/bec-neon.css'));
check('mtg_imports_same_theme',theme.includes("@import url('/assets/bec-neon.css')"));
check('shared_body_typography',shared.includes('Inter,"Segoe UI",system-ui,sans-serif'));
check('shared_heading_typography',shared.includes('"Space Grotesk",Inter,"Segoe UI",system-ui,sans-serif'));
check('shared_lime_signal',shared.includes('--signal:#c5ff35'));
check('no_gold_price_override',!/#e1b85b|#d8b56b|#e8c87a/i.test(theme));
check('white_price',theme.includes('.pricebox strong{color:var(--ink'));
check('reduced_motion',theme.includes('prefers-reduced-motion:reduce'));
check('focus_visible',theme.includes(':focus-visible'));
function walk(p){return fs.readdirSync(path.join(root,p),{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(p+'/'+x.name):[p+'/'+x.name])}
for(const p of [...walk('public/mtg'),...walk('public/mtg-list'),'public/mtg-list.html'].filter(p=>p.endsWith('.html'))){const s=read(p);if(!s.includes('<body'))continue;check('shared_body:'+p,/<body[^>]*class="[^"]*bec-neon/.test(s));check('adapter:'+p,s.includes('/assets/mtg-dreamledger-theme.css'));check('no_legacy_gold:'+p,!/#e1b85b|#d8b56b|#e8c87a/i.test(s));}
for(const p of ['BEC-PRIME/website/assets/mtg-dreamledger-theme.css','BEC-PRIME/compiled/website/assets/mtg-dreamledger-theme.css'])check('mirror:'+p,read(p)===theme);
const l=h=>{let v=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722};const contrast=(a,b)=>(Math.max(l(a),l(b))+.05)/(Math.min(l(a),l(b))+.05);
check('text_contrast',contrast('#f7f9fb','#080b10')>=4.5);check('muted_contrast',contrast('#b3bfcb','#111722')>=4.5);check('button_contrast',contrast('#081009','#c5ff35')>=4.5);
const proof={schema:'MTG/SHARED-THEME-PROOF/v2',authority:'public/assets/bec-neon.css',pass:checks.every(x=>x.status==='PASS'),checks,shared_sha256:crypto.createHash('sha256').update(shared).digest('hex')};fs.mkdirSync(path.join(root,'proof'),{recursive:true});fs.writeFileSync(path.join(root,'proof/MTG-DREAMLEDGER-VISUAL-PARITY.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({status:proof.pass?'PASS':'FAIL',checks:checks.length,failures:checks.filter(x=>x.status==='FAIL')}));if(!proof.pass)process.exitCode=1;
