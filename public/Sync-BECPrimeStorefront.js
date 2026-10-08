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
copyTree(SOURCE,DEST);

for(const required of ['index.html','mtg/index.html','mtg-search.html','mtg-list.html']){
  const file=path.join(DEST,required);
  if(!fs.existsSync(file)) throw new Error('Required public surface missing: '+required);
}
console.log(JSON.stringify({status:'PASS',source:SOURCE,destination:DEST,required:['index.html','mtg/index.html','mtg-search.html','mtg-list.html']}));
