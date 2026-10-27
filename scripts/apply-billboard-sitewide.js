#!/usr/bin/env node
'use strict';
// One visual language, without mixing any silo data, brand or workflows.
// Idempotently applies the DreamLedger billboard visual foundation to all
// customer-facing HTML including nested communities and niche storefronts.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const publicRoot=path.join(root,'public');
const compiledRoot=path.join(root,'BEC-PRIME','compiled','website');
const cssFile=path.join(publicRoot,'assets','billboard-site.css');
const check=process.argv.includes('--check');
const preview=process.argv.includes('--dry-run');
if(!fs.existsSync(cssFile))throw new Error('BILLBOARD_STYLESHEET_MISSING');
const css=fs.readFileSync(cssFile,'utf8');
for(const color of ['#080b10','#111722','#2c3747','#f7f9fb','#c5ff35']){
  if(!css.includes(color))throw new Error('BILLBOARD_DESIGN_DRIFT_'+color);
}
const folders=[publicRoot,compiledRoot].filter(fs.existsSync);
const excluded=new Set(['node_modules','.git','.next','dist','coverage']);
const files=[];
function walk(dir){
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    if(excluded.has(item.name))continue;
    const file=path.join(dir,item.name);
    if(item.isDirectory())walk(file);
    else if(item.isFile()&&item.name.toLowerCase().endsWith('.html'))files.push(file);
  }
}
for(const dir of folders)walk(dir);
const link='<link rel="stylesheet" href="/assets/billboard-site.css" data-site-theme="billboard">';
function transform(html){
  if(!/<html(?:\s|>)/i.test(html)||!/<\/head>/i.test(html))return null;
  let s=html.replace(/<html\b([^>]*)>/i,(whole,attrs)=>{
    if(/\bdata-beck-theme\s*=/.test(attrs))return whole;
    return '<html'+attrs+' data-beck-theme="billboard">';
  });
  if(!s.includes('data-site-theme="billboard"'))
    s=s.replace(/<\/head>/i,link+'\n</head>');
  return s;
}
let rewritten=0,unchanged=0,nonDocuments=0,nonconforming=[];
for(const file of files){
  const old=fs.readFileSync(file,'utf8');
  const next=transform(old);
  if(next===null){nonDocuments++;continue;}
  if(next===old){unchanged++;continue;}
  rewritten++;
  if(check)nonconforming.push(path.relative(root,file).replace(/\\/g,'/'));
  else if(!preview)fs.writeFileSync(file,next,'utf8');
}
const deployedAssets=path.join(compiledRoot,'assets','billboard-site.css');
if(fs.existsSync(compiledRoot)&&!check&&!preview){
  fs.mkdirSync(path.dirname(deployedAssets),{recursive:true});
  fs.copyFileSync(cssFile,deployedAssets);
}
const proof={schema:'dreamledger/billboard-sitewide-v1',mode:check?'CHECK':preview?'DRY_RUN':'WRITE',
  generated_utc:new Date().toISOString(),checked_files:files.length,already_themed:unchanged,
  awaiting_theme:rewritten,non_documents:nonDocuments,nonconforming:nonconforming.slice(0,25),
  palette_sha256:crypto.createHash('sha256').update(css).digest('hex'),
  status:check&&rewritten>0?'FAIL':'PASS'};
console.log(JSON.stringify(proof,null,2));
if(check&&rewritten>0)process.exitCode=1;
