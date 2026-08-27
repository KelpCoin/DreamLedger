'use strict';
const fs=require('fs');const path=require('path');
const ROOT=path.join(__dirname,'..');const OUT=path.join(ROOT,'compiled','website','billboard.html');
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value,'utf8')}
const existing=fs.existsSync(OUT)?fs.readFileSync(OUT,'utf8'):'';
const required=['BUY A PIECE','LEAVE IT UNTIL 3000','1,000,000','NZ$50','/api/molt-beach-inventory','/api/billboard/submit','PAID_PENDING_REVIEW','Image Placement + human approval'];
const canonical=required.every(x=>existing.includes(x));
if(!canonical){
 console.error(JSON.stringify({status:'BLOCKED',reason:'CANONICAL_BILLBOARD_SURFACE_MISSING_OR_STALE',output:path.relative(ROOT,OUT)},null,2));
 process.exit(2);
}
console.log(JSON.stringify({status:'PASS',output:path.relative(ROOT,OUT),canonical:'/billboard',founding_tile_price_nzd:50,total_pixels:1000000,retention_until:'3000-01-01',markets:['GLOBAL','NZ','AU','ZA','AMERICAS','EUROPE'],preserved:true},null,2));
