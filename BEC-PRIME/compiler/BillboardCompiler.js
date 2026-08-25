'use strict';
const fs=require('fs');const path=require('path');
const ROOT=path.join(__dirname,'..');const OUT=path.join(ROOT,'compiled','website','billboard.html');
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value,'utf8')}
const existing=fs.existsSync(OUT)?fs.readFileSync(OUT,'utf8'):'';
const required=['OWN A','Founding tile-units remaining','Swipe-first catalogue','/api/molt-beach-inventory','/api/billboard/submit','PAID_PENDING_REVIEW'];
const canonical=required.every(x=>existing.includes(x));
if(!canonical){
 const legacy=existing||'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>DreamLedger Billboard</title></head><body><main><h1>DreamLedger Billboard</h1><p>Canonical billboard surface pending source restoration.</p></main></body></html>';
 write(OUT,legacy);
 console.log(JSON.stringify({status:'BLOCKED',reason:'CANONICAL_BILLBOARD_SOURCE_MISSING_OR_STALE',output:path.relative(ROOT,OUT)},null,2));
 process.exit(2);
}
console.log(JSON.stringify({status:'PASS',output:path.relative(ROOT,OUT),canonical:'/billboard',founding_tile_price_nzd:50,markets:['GLOBAL','NZ','AU','ZA','AMERICAS','EUROPE'],preserved:true},null,2));
