'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const DEFAULT='silos/music-media/silo.json';
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const readJson=p=>JSON.parse(read(p));
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function build(manifestPath=DEFAULT){
 const m=readJson(manifestPath),i=m.identity||{},slug=i.slug;
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug||''))throw Error('Invalid silo slug');
 if(slug==='mtg')throw Error('MTG is the master, not a clone target; use it as the source shell only');
 if(i.canonical_path!=='/'+slug+'/')throw Error('Canonical path must match slug');
 if(i.catalog_path!=='/data/'+slug+'-catalog.json')throw Error('Catalogue path must be isolated to slug');
 if((i.platform_fee_bps??m.platform_fee_bps??500)!==500)throw Error('Every non-MTG clone must use 500 bps');
 if(!m.inventory_policy||m.inventory_policy.allow_invented_products!==false||m.inventory_policy.verified_supply_required!==true)throw Error('Unsafe inventory policy');
 for(const [name,ref] of Object.entries(m.capabilities||{}))if(typeof ref!=='string'||!ref.startsWith('ref:'))throw Error('Unbound capability '+name);
 const master=read('public/mtg/index.html');
 if(!master.includes('data-silo="mtg"')||!master.includes("const slug=document.documentElement.dataset.silo")||master.includes('innerHTML'))throw Error('MTG master failed safe-shell contract');
 if((m.products||[]).length)throw Error('Manifest must not embed inventory; inventory belongs in the catalogue');
 const page=slug==='mtg'?master:master.replace('data-silo="mtg"','data-silo="'+slug+'"');
 if(page.includes('data-silo="mtg"')&&slug!=='mtg')throw Error('Failed to bind clone slug');
 const empty=readJson('data/_catalog-empty.template.json'),catalogPath='data/'+slug+'-catalog.json';
 let existing=null;if(fs.existsSync(path.join(ROOT,catalogPath)))existing=readJson(catalogPath);
 if(existing&&existing.silo!==slug)throw Error('Existing catalogue belongs to another silo: '+slug);
 const products=existing&&Array.isArray(existing.products)?existing.products:[];
 if(products.some(p=>p.silo!==slug))throw Error('Cross-silo inventory in '+slug+' catalogue');
 const status=existing&&existing.status?existing.status:(products.length?'DRAFT_LISTINGS':'BUILD_NO_PUBLISHED_LISTINGS');
 const catalog={...(existing||{}),schema:'dreamledger/'+slug+'-catalogue/v1',silo:slug,currency:(existing&&existing.currency)||i.currency||'NZD',status,updated:(existing&&existing.updated)||'2026-10-14',products,_meta:{...empty._meta,...((existing&&existing._meta)||{}),generated_from:manifestPath,source_master:'public/mtg/index.html',verified_supply_required:true,status}};
 const alias='<!doctype html>\n<html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url='+i.canonical_path+'"><link rel="canonical" href="https://dreamledger.org'+i.canonical_path+'"><title>'+esc(i.display_name)+' | DreamLedger</title><script>location.replace('+JSON.stringify(i.canonical_path)+');</script></head><body><p><a href="'+i.canonical_path+'">Continue to '+esc(i.display_name)+' →</a></p></body></html>\n';
 return {[slug+'/index.html']:page,['public/'+slug+'/index.html']:page,['public/silos/'+slug+'/silo.json']:JSON.stringify(m,null,2)+'\n',['data/'+slug+'-catalog.json']:JSON.stringify(catalog,null,2)+'\n',['public/data/'+slug+'-catalog.json']:JSON.stringify(catalog,null,2)+'\n',[slug+'.html']:alias,['public/'+slug+'.html']:alias};
}
function compile(manifestPath=DEFAULT,checkOnly=false){
 const outputs=build(manifestPath),drift=[];
 for(const [rel,body] of Object.entries(outputs)){const dest=path.join(ROOT,rel);if(checkOnly){if(!fs.existsSync(dest)||read(rel)!==body)drift.push(rel);}else{fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,body,'utf8');}}
 const proof={schema:'DREAMLEDGER/CUBE-MTG-MASTER-CLONE/v1',status:drift.length?'FAIL':checkOnly?'PASS':'GENERATED',manifest:manifestPath,source_master:'public/mtg/index.html',files:Object.keys(outputs),drift};
 console.log(JSON.stringify(proof,null,2));if(drift.length)process.exitCode=1;return proof;
}
if(require.main===module){const args=process.argv.slice(2),idx=args.indexOf('--manifest');compile(idx<0?DEFAULT:args[idx+1],args.includes('--check'));}
module.exports={build,compile};
