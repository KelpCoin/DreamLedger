'use strict';
const path=require('path');
const {spawnSync}=require('child_process');
const root=path.resolve(__dirname,'../..');
const args=process.argv.slice(2);
const i=args.indexOf('--manifest');
const manifest=i>=0?args[i+1]:'silos/music-media/silo.json';
const check=args.includes('--check');
const jobs=[
 ['SiloCloneCompiler.js',['--manifest',manifest]],
 ['TcgSiloCompiler.js',[]],
 ['SiloRegistryCompiler.js',['--manifest',manifest]]
];
for(const [file,extra] of jobs){
 const argv=[path.join(__dirname,file),...extra,...(check?['--check']:[])];
 const r=spawnSync(process.execPath,argv,{cwd:root,stdio:'inherit'});
 if(r.error)throw r.error;
 if(r.status!==0)process.exit(r.status||1);
}
console.log(JSON.stringify({schema:'DREAMLEDGER/CUBE-SILO-FACTORY/v1',status:check?'PASS':'GENERATED',manifest,tcg_swarm_compiled:true,registry_policy_compiled:true}));
