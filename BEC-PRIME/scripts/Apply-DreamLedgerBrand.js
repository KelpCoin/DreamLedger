'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'compiled', 'website');
const CSS_HREF = '/assets/dreamledger-core.css';
const MARKER = 'data-dreamledger-core-brand="v1"';

const CORE_FILES = new Set([
  'index.html',
  'login.html',
  'register.html',
  'account.html',
  'buy.html',
  'sell.html',
  'catalogue.html',
  'marketplace.html',
  'truth-oracle.html',
  'billboard.html',
  'mtg/index.html',
  'mtg-search.html',
  'mtg-list.html',
  'mtg-catalog.html',
  'mtg-configurator.html',
  'mtg-diagnostic.html',
  'mtg-diagnostic-success.html'
]);

function inject(file){
  let html=fs.readFileSync(file,'utf8');
  if(!/<html\\b/i.test(html) || !/<head\\b/i.test(html)) return false;
  if(html.includes(CSS_HREF) && html.includes(MARKER)) return false;
  const tag='<link rel="stylesheet" href="'+CSS_HREF+'" '+MARKER+'>';
  html=html.replace(/<head([^>]*)>/i, '<head$1>\\n'+tag);
  fs.writeFileSync(file,html);
  return true;
}

let changed=0;
for(const rel of CORE_FILES){
  const file=path.join(ROOT,rel);
  if(fs.existsSync(file) && inject(file)) changed++;
}
const assetDir=path.join(ROOT,'assets');
fs.mkdirSync(assetDir,{recursive:true});
const cssFile=path.join(assetDir,'dreamledger-core.css');
const canonical=fs.readFileSync(path.join(__dirname,'..','website','assets','dreamledger-core.css'),'utf8');
if(!fs.existsSync(cssFile) || fs.readFileSync(cssFile,'utf8')!==canonical) fs.writeFileSync(cssFile,canonical);
console.log(JSON.stringify({status:'PASS',brand:'DreamLedger Core v1',changed,core_files:CORE_FILES.size,css:CSS_HREF}));
