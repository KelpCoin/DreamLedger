#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const SOURCE = path.join(ROOT, 'BEC-PRIME', 'compiled', 'website');
const TARGET = path.join(ROOT, 'public');
const PRESERVE = [
  'avatar.html',
  'billboard.html',
  'cash.html',
  'home.html',
  'shop.html',
  'mtg-list.html',
  'RELEASE_V21.json',
  'silos/mtg/silo.json',
  'data/mtg-catalog.json',
  'data/_catalog-empty.template.json',
  'assets/mtg-deck-grid.js',
  'assets/mtg-deck-grid.css',
  'assets/silo-master.css',
  'assets/avatar-identity.js',
  'assets/avatar-chip.js',
  'assets/avatar-runtime.js',
  'data/decklists',
  'mtg',
];
function ensureDir(p){fs.mkdirSync(p,{recursive:true});}
function copyRecursive(src,dest){
  const stat=fs.statSync(src);
  if(stat.isDirectory()){ensureDir(dest);for(const e of fs.readdirSync(src))copyRecursive(path.join(src,e),path.join(dest,e));}
  else{ensureDir(path.dirname(dest));fs.copyFileSync(src,dest);}
}
function snapshotPreserve(){
  const snaps=new Map();
  for(const rel of PRESERVE){
    const full=path.join(TARGET,rel);
    if(!fs.existsSync(full))continue;
    const stat=fs.statSync(full);
    if(stat.isDirectory()){
      const tmp=path.join(ROOT,'.tmp-preserve',rel);
      if(fs.existsSync(tmp))fs.rmSync(tmp,{recursive:true,force:true});
      copyRecursive(full,tmp);snaps.set(rel,{type:'dir',tmp});
    } else snaps.set(rel,{type:'file',content:fs.readFileSync(full)});
  }
  return snaps;
}
function restorePreserve(snaps){
  for(const [rel,snap] of snaps){
    const full=path.join(TARGET,rel);
    if(snap.type==='dir'){
      if(fs.existsSync(full))fs.rmSync(full,{recursive:true,force:true});
      copyRecursive(snap.tmp,full);
      try{fs.rmSync(snap.tmp,{recursive:true,force:true});}catch(_){}
    } else {ensureDir(path.dirname(full));fs.writeFileSync(full,snap.content);}
  }
}
function main(){
  console.log('[Sync] start');
  if(!fs.existsSync(SOURCE)){console.error('SOURCE missing');process.exit(1);}
  const snaps=snapshotPreserve();
  copyRecursive(SOURCE,TARGET);
  restorePreserve(snaps);
  const tmp=path.join(ROOT,'.tmp-preserve');
  if(fs.existsSync(tmp))try{fs.rmSync(tmp,{recursive:true,force:true});}catch(_){}
  console.log('[Sync] preserved avatar/cash/mtg/home/shop');
}
main();
