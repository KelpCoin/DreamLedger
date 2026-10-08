'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'compiled', 'website');
const CSS_HREF = '/assets/dreamledger-core.css';
const MARKER = 'data-dreamledger-core-brand="v1"';

function authoredHtmlFiles(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name.startsWith('.') || entry.name==='node_modules') continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) out.push(...authoredHtmlFiles(full));
    else if(entry.isFile() && entry.name.toLowerCase().endsWith('.html')) out.push(full);
  }
  return out;
}

function inject(file){
  let html=fs.readFileSync(file,'utf8');
  if(!/<html\b/i.test(html) || !/<head\b/i.test(html)) return false;
  if(html.includes(CSS_HREF) && html.includes(MARKER)) return false;
  const tag='<link rel="stylesheet" href="'+CSS_HREF+'" '+MARKER+'>';
  html=html.replace(/<head([^>]*)>/i, '<head$1>\\n'+tag);
  fs.writeFileSync(file,html);
  return true;
}

let changed=0;
let scanned=0;
for(const file of authoredHtmlFiles(ROOT)){
  scanned++;
  if(inject(file)) changed++;
}
const assetDir=path.join(ROOT,'assets');
fs.mkdirSync(assetDir,{recursive:true});
const cssFile=path.join(assetDir,'dreamledger-core.css');
const canonical=fs.readFileSync(path.join(__dirname,'..','website','assets','dreamledger-core.css'),'utf8');
if(!fs.existsSync(cssFile) || fs.readFileSync(cssFile,'utf8')!==canonical) fs.writeFileSync(cssFile,canonical);
console.log(JSON.stringify({status:'PASS',brand:'DreamLedger Core v1',changed,scanned,css:CSS_HREF}));
