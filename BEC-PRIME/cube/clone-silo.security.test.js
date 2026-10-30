'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {compileSilo}=require('./clone-silo');
const baby=require('./examples/baby-kids.example.json');
test('sensitive nested keys and provider secret strings are rejected before output',()=>{
 for(const c of [
   {...baby,brand:{...baby.brand,customer_email:'someone@example.test'}},
   {...baby,seed_candidates:[{sku:'BABY-1',title:'test',price_minor:10,attributes:{size:'sk_live_fake_secret'}}]},
   {...baby,extra:{payload:{stripe_api_key:'value'}}},
   {...baby,headers:{authentication:'Bearer mnbvcxz1234567890'}}
 ])assert.throws(()=>compileSilo(c),/forbidden input|credential-like input/);
});
test('standalone CLI refuses public output even when invoked from another cwd',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cube-security-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const input=path.join(root,'config.json');fs.writeFileSync(input,JSON.stringify(baby));
 const forbidden=path.resolve(__dirname,'..','..','public','cube-should-not-appear');
 const run=spawnSync(process.execPath,[path.join(__dirname,'clone-silo.js'),input,forbidden],{cwd:root,encoding:'utf8'});
 assert.notEqual(run.status,0);
 assert.match(run.stderr,/refuse automatic public writes/);
 assert.equal(fs.existsSync(forbidden),false);
});
test('standalone CLI refuses symlink into public output',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cube-symlink-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const input=path.join(root,'config.json');fs.writeFileSync(input,JSON.stringify(baby));
 const alias=path.join(root,'alias');
 try{fs.symlinkSync(path.resolve(__dirname,'..','..','public'),alias,'dir');}catch(e){t.diagnostic('symlink permission unavailable');return;}
 const run=spawnSync(process.execPath,[path.join(__dirname,'clone-silo.js'),input,path.join(alias,'niche')],{cwd:root,encoding:'utf8'});
 assert.notEqual(run.status,0);
 assert.match(run.stderr,/refuse symlink public writes/);
});
