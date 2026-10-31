'use strict';
/* Read-only visual parity gate. Does not deploy, sell or change commerce. */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const errors=[];
const checks=[];
function gate(name,pass,details){checks.push({name,status:pass?'PASS':'FAIL',details:details||null});if(!pass)errors.push(name);}
const homepage=read('public/index.html');
const baseCss=read('public/assets/mtg-dreamledger-theme.css');
const cssCopies=['public/assets/mtg-dreamledger-theme.css','BEC-PRIME/website/assets/mtg-dreamledger-theme.css','BEC-PRIME/compiled/website/assets/mtg-dreamledger-theme.css'];
for(const p of cssCopies){
  try{gate('css_mirror:'+p,read(p)===baseCss,{sha256:sha(read(p))});}
  catch(e){gate('css_mirror:'+p,false,e.code||e.message);}
}
const homepageTokens={bg:['--bg','#0b1220'],panel:['--panel','#111d2e'],line:['--line','#2a3b51'],ink:['--ink','#f4f7fb'],muted:['--muted','#b4c0cf'],mint:['--mint','#a9f2d0'],gold:['--gold','#e1b85b']};
for(const [key,[home,expected]] of Object.entries(homepageTokens)){
  gate('homepage_'+key,homepage.includes(home+':'+expected));
  gate('mtg_token_'+key,baseCss.includes('--dl-home-'+key+':'+expected));
}
gate('font_parity',homepage.includes('system-ui,sans-serif')&&baseCss.includes('--dl-home-font:system-ui'));
gate('color_scheme',baseCss.includes('color-scheme:dark'));
gate('contrast_focus',baseCss.includes('outline:3px solid var(--dl-home-mint)'));
gate('reduced_motion',baseCss.includes('prefers-reduced-motion:reduce'));
gate('theme_scoped_only',baseCss.includes(':root[data-silo="mtg"]')&&!/^body\\s*\\{/m.test(baseCss));
const htmlFiles=[
'public/mtg/index.html','mtg/index.html','BEC-PRIME/compiled/website/mtg/index.html',
'BEC-PRIME/website/mtg-catalog.html','public/mtg/forum/index.html',
'public/mtg/jon-irenicus-shattered-one.html','public/mtg/quintorius-field-historian.html',
'public/mtg/dwynen-gilt-leaf-daen.html','mtg/deck-upload.html',
'mtg/quintorius-field-historian.html','mtg/dwynen-gilt-leaf-daen.html',
'BEC-PRIME/compiled/website/mtg/diagnostic.html',
'BEC-PRIME/compiled/website/mtg/diagnostic-success.html',
'BEC-PRIME/compiled/website/mtg/configurator.html',
'BEC-PRIME/compiled/website/mtg.html','mtg.html'
];
for(const p of htmlFiles){
  try{
    const s=read(p);
    gate('page_scoped:'+p,/<html\b[^>]*data-silo="mtg"/i.test(s));
    gate('page_theme_link:'+p,s.includes('<link rel="stylesheet" href="/assets/mtg-dreamledger-theme.css">'));
    gate('page_theme_color:'+p,s.includes('<meta name="theme-color" content="#0b1220">'));
    gate('theme_load_order:'+p,s.lastIndexOf('</style>',s.indexOf('</head>'))<s.indexOf('href="/assets/mtg-dreamledger-theme.css"') && s.indexOf('href="/assets/mtg-dreamledger-theme.css"')<s.indexOf('</head>'));
  }catch(e){gate('page_read:'+p,false,e.code||e.message)}
}
for(const p of ['silos/mtg/silo.json','public/silos/mtg/silo.json','BEC-PRIME/compiled/website/silos/mtg/silo.json']){
  try{
    const o=JSON.parse(read(p));
    gate('manifest_mint:'+p,o.accent==='#a9f2d0'&&o.accent_bright==='#a9f2d0'&&o.slug==='mtg');
    gate('manifest_isolation:'+p,Object.values(o.isolation||{}).every(x=>x===true));
    gate('manifest_no_checkout_activation:'+p,o.payment_truth==='settled_payment_only');
  }catch(e){gate('manifest_read:'+p,false,e.code||e.message)}
}
const cssRgb=(hex)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
const lum=h=>cssRgb(h).reduce((acc,n,i)=>acc+n*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return ((Math.max(x,y)+.05)/(Math.min(x,y)+.05))};
gate('contrast_body_aa',ratio('#f4f7fb','#0b1220')>=4.5,{ratio:+ratio('#f4f7fb','#0b1220').toFixed(2)});
gate('contrast_muted_aa',ratio('#b4c0cf','#0b1220')>=4.5,{ratio:+ratio('#b4c0cf','#0b1220').toFixed(2)});
gate('contrast_cta_aa',ratio('#08130e','#a9f2d0')>=4.5,{ratio:+ratio('#08130e','#a9f2d0').toFixed(2)});
const report={
 schema:'BECK/MTG-DREAMLEDGER-VISUAL-PARITY/v1',
 audited_against:'public/index.html',
 canonical_site:'https://dreamledger.org/',
 scope:'/mtg/ only; no commerce or cross-silo mutations',
 color_system:'navy/mint with gold secondary',
 checked_files:htmlFiles.length+cssCopies.length+3,
 pass:errors.length===0,
 checks_passed:checks.filter(c=>c.status==='PASS').length,
 checks_failed:errors.length,
 failures:errors,
 checks,
 source_sha256:{homepage:sha(homepage),theme:sha(baseCss)}
};
const out=process.argv[2]||'proof/MTG-DREAMLEDGER-VISUAL-PARITY.json';
fs.mkdirSync(path.dirname(path.resolve(ROOT,out)),{recursive:true});
fs.writeFileSync(path.resolve(ROOT,out),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({status:report.pass?'PASS':'FAIL',checks_passed:report.checks_passed,checks_failed:report.checks_failed,proof:out},null,2));
if(errors.length)process.exitCode=1;
