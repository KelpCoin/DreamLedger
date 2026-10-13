'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const ROOT=path.resolve(__dirname,'../..');
const DEFAULT='runtime/cube/silo-manifests/music-media.json';
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const readJson=p=>JSON.parse(read(p));
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function build(manifestPath=DEFAULT){
 const m=readJson(manifestPath);
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(m.slug)||m.path!=='/'+m.slug+'/')throw Error('Invalid silo slug/path');
 if(m.silo_key==='MTG'?m.platform_fee_bps!==0:m.platform_fee_bps!==500)throw Error('MTG=0 bps; non-MTG=500 bps invariant');
 const tpl=read('runtime/cube/templates/silo-index.html');
 const cfg={slug:m.slug,name:m.name,path:m.path,description:m.description,eyebrow:m.eyebrow,headline_prefix:m.headline_prefix,headline_emphasis:m.headline_emphasis,hero_copy:m.hero_copy,category_heading:m.category_heading,category_intro:m.category_intro,accent:m.accent,accent_bright:m.accent_bright,currency:m.currency,catalogue_path:m.catalogue_path,categories:m.categories};
 const values={SLUG:m.slug,TITLE:esc(m.title),DESCRIPTION:esc(m.description),PATH:m.path,ACCENT:m.accent,ACCENT_BRIGHT:m.accent_bright,NAME:esc(m.name),EYEBROW:esc(m.eyebrow),HEADLINE_PREFIX:esc(m.headline_prefix),HEADLINE_EMPHASIS:esc(m.headline_emphasis),HERO_COPY:esc(m.hero_copy),CATEGORY_HEADING:esc(m.category_heading),CATEGORY_INTRO:esc(m.category_intro),CONFIG_JSON:JSON.stringify(cfg).replace(/</g,'\\u003c')};
 const page=tpl.replace(/\{\{([A-Z0-9_]+)\}\}/g,(s,k)=>{if(!(k in values))throw Error('Unknown token '+k);return values[k];});
 if(/\{\{[A-Z0-9_]+\}\}/.test(page))throw Error('Unresolved template token');
 const products=m.products||[];
 if(products.some(p=>p.silo!==m.slug))throw Error('Cross-silo product');
 const catalog={schema:'dreamledger/'+m.slug+'-catalogue/v1',silo:m.slug,currency:m.currency||'NZD',status:products.length?'DRAFT_LISTINGS':'BUILD_NO_PUBLISHED_LISTINGS',updated:m.updated||'2026-10-14',products,publication_requirements:['Creator identity and credits recorded','Ownership or distribution rights evidenced','Exact format and deliverables described','Price, currency, availability and refund terms explicit','Checkout enabled only after live Stripe URL and attribution are verified','Fulfilment tested from settlement through delivery evidence']};
 const alias='<!doctype html>\n<html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url='+m.path+'"><link rel="canonical" href="https://dreamledger.org'+m.path+'"><title>'+esc(m.name)+' | DreamLedger</title><script>location.replace('+JSON.stringify(m.path)+');</script></head><body><p><a href="'+m.path+'">Continue to '+esc(m.name)+' →</a></p></body></html>\n';
 const registry=readJson('docs/BECK-EMPIRE-SILO-REGISTRY.json'),policy=readJson('docs/BECK-SILO-FEE-POLICY.json');
 const old=registry.silos[m.silo_key];
 if(old&&old.id!==m.silo_id)throw Error('Duplicate silo key');
 registry.silos[m.silo_key]={...(old||{}),id:m.silo_id,public_domains:['dreamledger.org'],public_prefixes:[m.path.replace(/\/$/,'')],platform_fee_bps:m.platform_fee_bps,status:m.status,first_dollar_priority:m.first_dollar_priority,cross_silo_forbidden_domains:m.cross_silo_forbidden_domains||[],cross_silo_forbidden_terms:m.cross_silo_forbidden_terms||[]};
 policy.rules[m.silo_id]={silo:m.silo_key,domain:'dreamledger.org'+m.path.replace(/\/$/,''),platform_fee_bps:m.platform_fee_bps,label:m.platform_fee_bps===0?'0% forever':'5% flat'};
 if(Number(registry.silos.MTG.platform_fee_bps)!==0)throw Error('MTG fee invariant broken');
 for(const [k,v] of Object.entries(registry.silos))if(k!=='MTG'&&Number(v.platform_fee_bps)!==500)throw Error('Fee invariant broken: '+k);
 const files={
  [m.slug+'/index.html']:page,['public/'+m.slug+'/index.html']:page,
  ['data/'+m.slug+'-catalog.json']:JSON.stringify(catalog,null,2)+'\n',
  ['public/data/'+m.slug+'-catalog.json']:JSON.stringify(catalog,null,2)+'\n',
  [m.slug+'.html']:alias,['public/'+m.slug+'.html']:alias,
  'docs/BECK-EMPIRE-SILO-REGISTRY.json':JSON.stringify(registry,null,2)+'\n',
  'docs/BECK-SILO-FEE-POLICY.json':JSON.stringify(policy,null,2)+'\n'
 };
 return {manifest:m,files,hash:crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex')};
}
function run(mp,check){
 const o=build(mp||DEFAULT),drift=[];
 for(const [rel,content] of Object.entries(o.files)){const p=path.join(ROOT,rel);if(check){if(!fs.existsSync(p)||read(rel)!==content)drift.push(rel);}else{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,content);}}
 const proof={schema:'DREAMLEDGER/CUBE-SILO-CLONE/v1',status:drift.length?'FAIL':check?'PASS':'GENERATED',silo_id:o.manifest.silo_id,slug:o.manifest.slug,files:Object.keys(o.files),drift,integrity_sha256:o.hash};
 console.log(JSON.stringify(proof,null,2));if(drift.length)process.exitCode=1;return proof;
}
if(require.main===module){const a=process.argv.slice(2),i=a.indexOf('--manifest');run(i<0?DEFAULT:a[i+1],a.includes('--check'));}
module.exports={build,run};
