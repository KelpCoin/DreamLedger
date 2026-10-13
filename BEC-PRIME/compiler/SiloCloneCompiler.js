'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const MANIFEST='runtime/cube/silo-manifests/music-media.json';
const TEMPLATE='runtime/cube/templates/silo-index.html';
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function compile(){
 const m=JSON.parse(fs.readFileSync(path.join(ROOT,MANIFEST),'utf8'));
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(m.slug)||m.path!=='/'+m.slug+'/')throw Error('Invalid silo identity');
 if(m.silo_key==='MTG'?m.platform_fee_bps!==0:m.platform_fee_bps!==500)throw Error('Fee invariant violation');
 const cfg={slug:m.slug,name:m.name,path:m.path,description:m.description,eyebrow:m.eyebrow,headline_prefix:m.headline_prefix,headline_emphasis:m.headline_emphasis,hero_copy:m.hero_copy,category_heading:m.category_heading,category_intro:m.category_intro,accent:m.accent,accent_bright:m.accent_bright,currency:m.currency,catalogue_path:m.catalogue_path,categories:m.categories};
 const vals={SLUG:m.slug,TITLE:esc(m.title),DESCRIPTION:esc(m.description),PATH:m.path,ACCENT:m.accent,ACCENT_BRIGHT:m.accent_bright,NAME:esc(m.name),EYEBROW:esc(m.eyebrow),HEADLINE_PREFIX:esc(m.headline_prefix),HEADLINE_EMPHASIS:esc(m.headline_emphasis),HERO_COPY:esc(m.hero_copy),CATEGORY_HEADING:esc(m.category_heading),CATEGORY_INTRO:esc(m.category_intro),CONFIG_JSON:JSON.stringify(cfg).replace(/</g,'\\u003c')};
 const tpl=fs.readFileSync(path.join(ROOT,TEMPLATE),'utf8');
 const page=tpl.replace(/\{\{([A-Z0-9_]+)\}\}/g,(s,k)=>{if(!(k in vals))throw Error('Unknown template token '+k);return vals[k];});
 if(/\{\{[A-Z0-9_]+\}\}/.test(page))throw Error('Unresolved template token');
 const catalog={schema:'dreamledger/'+m.slug+'-catalogue/v1',silo:m.slug,currency:m.currency||'NZD',status:'BUILD_NO_PUBLISHED_LISTINGS',updated:m.updated||'2026-10-14',products:m.products||[],publication_requirements:['Rights verified','Price and availability explicit','Checkout only after Stripe link parity','Fulfilment evidence required']};
 const alias='<!doctype html>\n<html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url='+m.path+'"><link rel="canonical" href="https://dreamledger.org'+m.path+'"><title>'+esc(m.name)+' | DreamLedger</title><script>location.replace('+JSON.stringify(m.path)+');</script></head><body><p><a href="'+m.path+'">Continue to '+esc(m.name)+' →</a></p></body></html>\n';
 const out={[m.slug+'/index.html']:page,['public/'+m.slug+'/index.html']:page,['data/'+m.slug+'-catalog.json']:JSON.stringify(catalog,null,2)+'\n',['public/data/'+m.slug+'-catalog.json']:JSON.stringify(catalog,null,2)+'\n',[m.slug+'.html']:alias,['public/'+m.slug+'.html']:alias};
 for(const [rel,body] of Object.entries(out)){const dest=path.join(ROOT,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,body,'utf8');}
 console.log(JSON.stringify({status:'GENERATED',slug:m.slug,files:Object.keys(out)},null,2));
}
if(require.main===module)compile();
module.exports={compile};
