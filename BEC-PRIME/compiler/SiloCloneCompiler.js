'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const DEFAULT='silos/music-media/silo.json';
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function build(manifestPath=DEFAULT){
 const m=JSON.parse(read(manifestPath)),i=m.identity||{},s=m.surface||{},slug=i.slug;
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||i.canonical_path!=='/'+slug+'/'||i.catalog_path!=='/data/'+slug+'-catalog.json')throw Error('Invalid silo identity or route');
 if(slug==='mtg'?m.platform_fee_bps!==0:m.platform_fee_bps!==500)throw Error('MTG=0 bps; non-MTG=500 bps invariant');
 const cfg={slug,name:i.display_name,path:i.canonical_path,description:m.description,eyebrow:s.eyebrow,headline_prefix:s.headline_prefix,headline_emphasis:s.headline_emphasis,hero_copy:s.tagline,category_heading:s.category_heading,category_intro:s.category_intro,accent:i.accent_color,accent_bright:i.accent_bright,currency:m.currency||'NZD',catalogue_path:i.catalog_path,categories:s.categories||[]};
 const vals={SLUG:slug,TITLE:esc(i.display_name+' | DreamLedger'),DESCRIPTION:esc(m.description||s.tagline),PATH:i.canonical_path,ACCENT:i.accent_color,ACCENT_BRIGHT:i.accent_bright,NAME:esc(i.display_name),EYEBROW:esc(s.eyebrow),HEADLINE_PREFIX:esc(s.headline_prefix),HEADLINE_EMPHASIS:esc(s.headline_emphasis),HERO_COPY:esc(s.tagline),CATEGORY_HEADING:esc(s.category_heading),CATEGORY_INTRO:esc(s.category_intro),CONFIG_JSON:JSON.stringify(cfg).replace(/</g,'\\u003c')};
 const tpl=read('runtime/cube/templates/silo-index.html');
 const page=tpl.replace(/\{\{([A-Z0-9_]+)\}\}/g,(x,k)=>{if(!(k in vals))throw Error('Unknown template token '+k);return vals[k];});
 if(/\{\{[A-Z0-9_]+\}\}/.test(page))throw Error('Unresolved template token');
 const products=m.products||[];
 if(products.some(p=>p.silo!==slug))throw Error('Cross-silo product');
 const catalog={schema:'dreamledger/'+slug+'-catalogue/v1',silo:slug,currency:m.currency||'NZD',status:products.length?'DRAFT_LISTINGS':'BUILD_NO_PUBLISHED_LISTINGS',updated:m.updated||'2026-10-14',products,publication_requirements:['Rights verified','Price and availability explicit','Checkout only after Stripe link parity','Fulfilment evidence required']};
 const alias='<!doctype html>\n<html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url='+i.canonical_path+'"><link rel="canonical" href="https://dreamledger.org'+i.canonical_path+'"><title>'+esc(i.display_name)+' | DreamLedger</title><script>location.replace('+JSON.stringify(i.canonical_path)+');</script></head><body><p><a href="'+i.canonical_path+'">Continue to '+esc(i.display_name)+' →</a></p></body></html>\n';
 return {[slug+'/index.html']:page,['public/'+slug+'/index.html']:page,['data/'+slug+'-catalog.json']:JSON.stringify(catalog,null,2)+'\n',['public/data/'+slug+'-catalog.json']:JSON.stringify(catalog,null,2)+'\n',[slug+'.html']:alias,['public/'+slug+'.html']:alias};
}
function compile(manifestPath=DEFAULT,checkOnly=false){
 const outputs=build(manifestPath),drift=[];
 for(const [rel,body] of Object.entries(outputs)){const dest=path.join(ROOT,rel);if(checkOnly){if(!fs.existsSync(dest)||read(rel)!==body)drift.push(rel);}else{fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,body,'utf8');}}
 const proof={schema:'DREAMLEDGER/CUBE-SILO-CLONE/v1',status:drift.length?'FAIL':checkOnly?'PASS':'GENERATED',manifest:manifestPath,files:Object.keys(outputs),drift};
 console.log(JSON.stringify(proof,null,2));if(drift.length)process.exitCode=1;return proof;
}
if(require.main===module){const args=process.argv.slice(2),idx=args.indexOf('--manifest');compile(idx<0?DEFAULT:args[idx+1],args.includes('--check'));}
module.exports={build,compile};
