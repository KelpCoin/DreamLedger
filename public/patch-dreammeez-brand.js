'use strict';
const fs=require('fs');
const path=require('path');
const root=__dirname;
const replacements=[[/\bDreamiez\b/g,'DreamMeez'],[/\bDREAMIEZ\b/g,'DREAMMEEZ']];
function patchFile(file){
  if(!fs.existsSync(file))return false;
  let text=fs.readFileSync(file,'utf8');
  const before=text;
  for(const [rx,value] of replacements)text=text.replace(rx,value);
  fs.writeFileSync(file,text,'utf8');
  return text!==before;
}
const index=path.join(root,'index.html');
let html=fs.readFileSync(index,'utf8');
for(const [rx,value] of replacements)html=html.replace(rx,value);
if(!html.includes('DreamMeez')){
  html=html.replace('<nav class="navlinks"><a href="#catalogue">Catalogue</a>','<nav class="navlinks"><a href="#catalogue">Catalogue</a><a href="/avatar">DreamMeez</a>');
}
if(!html.includes('DreamMeez'))throw new Error('DreamMeez branding patch did not apply');
fs.writeFileSync(index,html,'utf8');
for(const name of fs.readdirSync(root))if(/\.(html|js|json|txt|xml|svg)$/i.test(name))patchFile(path.join(root,name));
console.log('PASS: DreamMeez public branding applied at storefront startup.');
