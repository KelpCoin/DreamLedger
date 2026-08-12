'use strict';
const fs=require('fs');
const path=require('path');
const os=require('os');
const {spawnSync}=require('child_process');
const source=fs.readFileSync(path.join(__dirname,'meta-gauntlet.js'),'utf8');
const patched=source.replace(/p\.price===1500/g,'p.price===2500').replace(/Commander must be 1500 NZ cents/g,'Commander must be 2500 NZ cents');
const tmp=path.join(os.tmpdir(),'dreamledger-meta-gauntlet-current.js');
fs.writeFileSync(tmp,patched,'utf8');
const result=spawnSync(process.execPath,[tmp],{cwd:path.join(__dirname,'..'),stdio:'inherit'});
try{fs.unlinkSync(tmp)}catch{}
process.exit(result.status===null?1:result.status);
