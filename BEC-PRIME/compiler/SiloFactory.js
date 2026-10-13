'use strict';
const path=require('path');
const {spawnSync}=require('child_process');
const root=path.resolve(__dirname,'../..');
const args=process.argv.slice(2),idx=args.indexOf('--manifest');
const manifest=idx>=0?args[idx+1]:'silos/music-media/silo.json',check=args.includes('--check');
if(!/^silos\/[a-z0-9]+(?:-[a-z0-9]+)*\/silo\.json$/.test(manifest))throw Error('Manifest must be silos/<slug>/silo.json');
for(const [file,extra] of [['SiloCloneCompiler.js',['--manifest',manifest]],['SiloRegistryCompiler.js',['--manifest',manifest]]]){
 const argv=[path.join(__dirname,file),...extra,...(check?['--check']:[])];
 const r=spawnSync(process.execPath,argv,{cwd:root,stdio:'inherit'});
 if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1);
}
console.log(JSON.stringify({schema:'DREAMLEDGER/CUBE-SILO-FACTORY/v1',status:check?'PASS':'GENERATED',manifest,master:'silos/mtg/silo.json',template:'public/mtg/index.html',inventories:'empty-unless-independently-verified'}));
