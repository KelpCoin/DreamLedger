'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function build(){
 const data=JSON.parse(read('public/data/tcg-swarm.json'));
 if(data.master!=='mtg')throw Error('MTG must remain the TCG master stencil');
 const tpl=read('runtime/cube/templates/tcg-silo-index.html'),out={};
 const clones=(data.silos||[]).filter(s=>s.status==='clone');
 if(!clones.length)throw Error('No TCG clone manifests');
 for(const s of clones){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.slug)||s.route!=='/'+s.slug+'/'||s.list_route!=='/tcg-list?game='+s.slug)throw Error('Invalid TCG route '+s.slug);
  for(const k of ['title','description','eyebrow','headline','lead','short','accent'])if(!s[k])throw Error('Missing TCG manifest field '+s.slug+'.'+k);
  const vals={SLUG:s.slug,TITLE:esc(s.title),DESCRIPTION:esc(s.description),SHORT:esc(s.short),ACCENT:s.accent,LIST_ROUTE:esc(s.list_route),EYEBROW:esc(s.eyebrow),HEADLINE:esc(s.headline),LEAD:esc(s.lead)};
  const page=tpl.replace(/\{\{([A-Z_]+)\}\}/g,(x,k)=>{if(!(k in vals))throw Error('Unknown TCG template token '+k);return vals[k];});
  if(/\{\{[A-Z_]+\}\}/.test(page))throw Error('Unresolved TCG template token '+s.slug);
  out['public/'+s.slug+'/index.html']=page;
 }
 return out;
}
function compile(checkOnly=false){
 const out=build(),drift=[];
 for(const [rel,body] of Object.entries(out)){const dest=path.join(ROOT,rel);if(checkOnly){if(!fs.existsSync(dest)||read(rel)!==body)drift.push(rel);}else{fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,body,'utf8');}}
 const proof={schema:'DREAMLEDGER/CUBE-TCG-CLONE/v1',status:drift.length?'FAIL':checkOnly?'PASS':'GENERATED',count:Object.keys(out).length,files:Object.keys(out),drift};
 console.log(JSON.stringify(proof,null,2));if(drift.length)process.exitCode=1;return proof;
}
if(require.main===module)compile(process.argv.includes('--check'));
module.exports={build,compile};
