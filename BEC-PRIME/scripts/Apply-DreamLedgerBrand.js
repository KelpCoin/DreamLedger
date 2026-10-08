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
  const hasCss=html.includes(CSS_HREF);
  const hasMarker=html.includes(MARKER);
  if(hasCss && hasMarker) return false;
  const tag='<link rel="stylesheet" href="'+CSS_HREF+'" '+MARKER+'>';
  if(hasCss){
    html=html.replace(/<link[^>]+dreamledger-core\\.css[^>]*>/i,tag);
  }else{
    if(!/<\/head>/i.test(html)) throw new Error('Brand injection target has no </head>: '+file);
    html=html.replace(/<\/head>/i,tag+'\n</head>');
  }
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
if(!fs.existsSync(path.join(ROOT,'mtg','index.html'))) throw new Error('Required MTG compiled surface missing');
const mtg=fs.readFileSync(path.join(ROOT,'mtg','index.html'),'utf8');
if(!mtg.includes(CSS_HREF) || !mtg.includes(MARKER)) throw new Error('MTG compiled surface did not receive canonical brand layer');
console.log(JSON.stringify({status:'PASS',brand:'DreamLedger Core v1',changed,scanned,css:CSS_HREF,mtg_brand:'PASS'}));
