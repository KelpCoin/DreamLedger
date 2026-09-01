'use strict';
const fs=require('fs');
const originalRead=fs.readFile;
const originalReadSync=fs.readFileSync;
function brand(text){
  return String(text)
    .replace(/\bDreamiez\b/g,'DreamMeez')
    .replace(/\bDREAMIEZ\b/g,'DREAMMEEZ')
    .replace('<nav class="navlinks"><a href="#catalogue">Catalogue</a>','<nav class="navlinks"><a href="#catalogue">Catalogue</a><a href="/avatar">DreamMeez</a>');
}
fs.readFile=function(file,options,callback){
  if(typeof options==='function'){callback=options;options='utf8';}
  return originalRead.call(fs,file,options,(err,data)=>{
    if(err)return callback(err,data);
    if(typeof file==='string' && /(?:^|[\\/])index\.html$/.test(file))return callback(null,brand(data));
    callback(null,data);
  });
};
fs.readFileSync=function(file,options){
  const data=originalReadSync.call(fs,file,options);
  if(typeof file==='string' && /(?:^|[\\/])index\.html$/.test(file))return brand(data);
  return data;
};
