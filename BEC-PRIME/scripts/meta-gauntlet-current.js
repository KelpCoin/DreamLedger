'use strict';
const fs=require('fs');
const path=require('path');
const source=fs.readFileSync(path.join(__dirname,'meta-gauntlet.js'),'utf8');
const patched=source.replace(/p\.price===1500/g,'p.price===2500').replace(/Commander must be 1500 NZ cents/g,'Commander must be 2500 NZ cents');
// Evaluate in this module context so repository-relative paths remain valid.
eval(patched);
