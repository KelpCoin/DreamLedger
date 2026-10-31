'use strict';
// Build only the owner-approved public customer surfaces. Never publish the
// internal economy, experimental products or other silos by copying public/ wholesale.
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const SRC=path.join(ROOT,'public');
const DST=path.join(ROOT,'public-release');
const REQUIRED=[
 'index.html','avatar.html','billboard.html','ticker.html','login.html','register.html','account.html',
 'privacy.html','terms.html','catalog.json','data/mtg-catalog.json',
 'data/mtg-owner-decks.json','data/mtg-owner-singles.json','data/mtg-auctions.json',
 'assets/dreamledger-mtg-theme.css','assets/mtg-auction-rail.js',
 'assets/mtg-deck-grid.js','assets/avatar-identity.js','assets/avatar-chip.js','assets/ticker.js'
];
const OPTIONAL=[
 'assets/mtg-deck-grid.css','assets/mtg-monte-carlo.js','assets/avatar-runtime.js',
 'assets/dreammeez-free-bodies.js','assets/dreamledger-core.css',
 'mtg-list.html','mtg-search.html','mtg-marketplace.html','favicon.ico','robots.txt'
];
const DIRECTORIES=['mtg','phinhaven','dreammeez','data/decklists','mtg-list','mtg-search','mtg-marketplace'];
function copy(rel,required){
 const src=path.join(SRC,rel),dst=path.join(DST,rel);
 if(!fs.existsSync(src)){if(required)throw Error('PUBLIC_RELEASE_REQUIRED_MISSING:'+rel);return}
 const st=fs.statSync(src);
 fs.mkdirSync(path.dirname(dst),{recursive:true});
 if(st.isDirectory())fs.cpSync(src,dst,{recursive:true,force:true});
 else if(st.isFile())fs.copyFileSync(src,dst);
}
fs.rmSync(DST,{recursive:true,force:true});fs.mkdirSync(DST,{recursive:true});
for(const f of REQUIRED)copy(f,true);
for(const f of OPTIONAL)copy(f,false);
for(const f of DIRECTORIES)copy(f,false);
// The public catalogue contains experimental and quarantined offers.
// Ship only MTG records already present in the approved MTG owner catalogue.
const mtg=JSON.parse(fs.readFileSync(path.join(DST,'data/mtg-catalog.json'),'utf8'));
const catalogue=JSON.parse(fs.readFileSync(path.join(DST,'catalog.json'),'utf8'));
if(mtg.silo!=='mtg'||!Array.isArray(mtg.products)||!Array.isArray(catalogue.products))throw Error('PUBLIC_MTG_CATALOG_INVALID');
const approved=new Set(mtg.products.map(x=>x.id));
catalogue.products=catalogue.products.filter(x=>approved.has(x.id));
if(!catalogue.products.length)throw Error('PUBLIC_RELEASE_EMPTY_MTG_CATALOG');
if(catalogue.products.some(x=>x.checkout_available===true))throw Error('PUBLIC_RELEASE_UNVERIFIED_CHECKOUT');
fs.writeFileSync(path.join(DST,'catalog.json'),JSON.stringify(catalogue,null,2)+'\n');
// Emit proof without exposing internal control planes or secret values.
const files=[];function walk(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name);
  if(entry.isDirectory())walk(full);
  else files.push(path.relative(DST,full).replaceAll(path.sep,'/'));
 }
}
walk(DST);
const disallowed=files.filter(f=>/^(?:agent-|agentic-|truth-oracle|b2b|quote-|pulse\/|residue|marketplace\.html|shop\.html)/i.test(f));
if(disallowed.length)throw Error('PUBLIC_RELEASE_QUARANTINE_LEAK:'+disallowed.join(','));
const proof={schema:'dreamledger/filtered-customer-release/v1',status:'PASS',customer_files:files.length,approved_surfaces:['mtg','billboard','avatar','phinhaven','ticker'],unverified_checkout_enabled:false,unapproved_pages_shipped:disallowed.length,generated_at:new Date().toISOString()};
fs.mkdirSync(path.join(ROOT,'artifacts'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'artifacts/filtered-customer-release-proof.json'),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof));
