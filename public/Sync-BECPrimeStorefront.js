'use strict';

const fs=require('fs');
const path=require('path');

const SOURCE=path.join(__dirname,'..','BEC-PRIME','compiled','website');
const DEST=__dirname;
const ALLOWED=new Set(['.html','.css','.js','.svg','.png','.jpg','.jpeg','.webp','.ico','.txt','.xml','.json']);

function copyTree(src,dst){
  for(const entry of fs.readdirSync(src,{withFileTypes:true})){
    const from=path.join(src,entry.name);
    const to=path.join(dst,entry.name);
    if(entry.isDirectory()){
      if(entry.name==='.well-known') continue;
      fs.mkdirSync(to,{recursive:true});
      copyTree(from,to);
    }else if(ALLOWED.has(path.extname(entry.name).toLowerCase()) && !['catalog.json','server.js','package.json','package-lock.json'].includes(entry.name)){
      fs.copyFileSync(from,to);
    }
  }
}

if(!fs.existsSync(SOURCE)) throw new Error('BEC-PRIME compiled website missing. Run npm run compile first.');
const canonicalPublicFiles=['avatar.html','billboard.html','home.html','mtg/index.html','data/mtg-catalog.json'];
const canonicalSnapshots=new Map(canonicalPublicFiles.map(rel=>{
  const file=path.join(DEST,rel);
  return [rel,fs.existsSync(file)?fs.readFileSync(file):null];
}));
copyTree(SOURCE,DEST);
// Preserve the reviewed public storefront versions. The compiled legacy tree
// can overwrite both with older surfaces (including a stale billboard checkout).
for(const [rel,bytes] of canonicalSnapshots){
  if(bytes) fs.writeFileSync(path.join(DEST,rel),bytes);
}

function copyStage0File(rel){
  const from=path.join(__dirname,'..',rel);
  const to=path.join(DEST,rel);
  if(!fs.existsSync(from)) throw new Error('Required PhinHaven source missing: '+rel);
  fs.mkdirSync(path.dirname(to),{recursive:true});
  fs.copyFileSync(from,to);
}
// Render's production storefront serves public/ as its root. Mirror the
// repository-level TEST pages into that served tree without changing their
// TEST/localStorage labels or implying production multiplayer.
for(const rel of ['phinhaven.html','phinhaven/hotel/index.html','phinhaven/shallows/index.html']){
  copyStage0File(rel);
}

const required=['index.html','mtg/index.html','mtg-search.html','mtg-list.html'];
for(const rel of required){
  const file=path.join(DEST,rel);
  if(!fs.existsSync(file)) throw new Error('Required public surface missing: '+rel);
}
const listFile=path.join(DEST,'mtg-list.html');
let list=fs.readFileSync(listFile,'utf8');
list=list.replace(/Buyers never need one\.?/gi,'Buying from another player requires a free DreamLedger account.');
list=list.replace(/buyers stay frictionless; sellers are known\.?/gi,'Marketplace participants have a persistent account identity.');
fs.writeFileSync(listFile,list);

const CANONICAL_DIAGNOSTIC_LINK='https://buy.stripe.com/eVqeVdc1T01n1DV3gwdwc30';
const LEGACY_DIAGNOSTIC_LINK='https://buy.stripe.com/8x228r1nfg0l3M32csdwc2I';
function requireDiagnosticContract(file,productKey){
  const parsed=JSON.parse(fs.readFileSync(file,'utf8'));
  const products=Array.isArray(parsed.products)?parsed.products:[];
  const product=products.find(p=>p&&p.id==='COMMANDER-DECK-DIAGNOSTIC-001'&&p.sku==='CMD-DIAG-29');
  if(!product||Number(product.price)!==29||String(product.currency||'').toLowerCase()!=='nzd'||product.checkout_url!==CANONICAL_DIAGNOSTIC_LINK){
    throw new Error('MTG_CANONICAL_DIAGNOSTIC_CONTRACT_FAILED:'+productKey);
  }
  if(products.some(p=>p&&p.checkout_url===LEGACY_DIAGNOSTIC_LINK)){
    throw new Error('MTG_LEGACY_DIAGNOSTIC_LINK_PRESENT:'+productKey);
  }
}
requireDiagnosticContract(path.join(DEST,'catalog.json'),'public-catalog');
requireDiagnosticContract(path.join(DEST,'data','mtg-catalog.json'),'mtg-silo-catalog');
const canonicalMtgPage=fs.readFileSync(path.join(DEST,'mtg','index.html'),'utf8');
if(!canonicalMtgPage.includes(CANONICAL_DIAGNOSTIC_LINK)||canonicalMtgPage.includes(LEGACY_DIAGNOSTIC_LINK)){
  throw new Error('MTG_CANONICAL_DIAGNOSTIC_PAGE_CONTRACT_FAILED');
}

console.log(JSON.stringify({status:'PASS',source:SOURCE,destination:DEST,required,account_contract:'PASS',mtg_canonical_diagnostic:'PASS',preserved_public_mtg:true}));
