'use strict';
const path=require('path'),fs=require('fs');
const {spawnSync}=require('child_process');
const root=path.resolve(__dirname,'../..'),args=process.argv.slice(2),idx=args.indexOf('--manifest');
const all=args.includes('--all'),check=args.includes('--check'),one=idx>=0?args[idx+1]:'silos/music-media/silo.json';
if(!all&&!/^silos\/[a-z0-9]+(?:-[a-z0-9]+)*\/silo\.json$/.test(one))throw Error('Manifest must be silos/<slug>/silo.json');
const manifests=all?fs.readdirSync(path.join(root,'silos'),{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name!=='mtg'&&fs.existsSync(path.join(root,'silos',d.name,'silo.json'))).map(d=>'silos/'+d.name+'/silo.json').sort():[one];
if(!manifests.length)throw Error('No candidate silo manifests found');
for(const manifest of manifests){if(manifest==='silos/mtg/silo.json')throw Error('MTG is the master, not a clone target');const r=spawnSync(process.execPath,[path.join(__dirname,'SiloCloneCompiler.js'),'--manifest',manifest,...(check?['--check']:[])],{cwd:root,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1);}
const regArgs=[path.join(__dirname,'SiloRegistryCompiler.js'),...(all?['--all']:['--manifest',one]),...(check?['--check']:[])];
const r=spawnSync(process.execPath,regArgs,{cwd:root,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1);
const masterPath=path.join(root,'silos/mtg/silo.json'),publicMasterPath=path.join(root,'public/silos/mtg/silo.json'),masterContent=JSON.stringify(JSON.parse(fs.readFileSync(masterPath,'utf8')),null,2)+'\n';
if(check){if(!fs.existsSync(publicMasterPath)||fs.readFileSync(publicMasterPath,'utf8')!==masterContent)throw Error('Public MTG master manifest drift');}else{fs.mkdirSync(path.dirname(publicMasterPath),{recursive:true});fs.writeFileSync(publicMasterPath,masterContent,'utf8');}
console.log(JSON.stringify({schema:'DREAMLEDGER/CUBE-SILO-FACTORY/v1',status:check?'PASS':'GENERATED',master:'silos/mtg/silo.json',template:'public/mtg/index.html',compiled_manifests:manifests,inventories:'empty-unless-independently-verified'}));
