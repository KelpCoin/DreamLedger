'use strict';
const fs=require('fs');const path=require('path');
const ROOT=path.join(__dirname,'..');let pass=true;
function check(label,ok){console.log((ok?'PASS ':'FAIL ')+label);if(!ok)pass=false;}
const policy=path.join(ROOT,'lib','marketplacePolicy.js');const server=path.join(ROOT,'server.js');const manifest=path.join(ROOT,'silos','SILO_DREAMIEZ','manifest.json');const page=path.join(ROOT,'silos','SILO_DREAMIEZ','compiled','website','dreamiez.html');const cosmetics=path.join(ROOT,'data','dreamiez','cosmetics.json');const users=path.join(ROOT,'data','dreamiez','users.json');const guilds=path.join(ROOT,'data','dreamiez','guilds.json');const sellers=path.join(ROOT,'data','sellers.json');
for(const [n,f] of Object.entries({policy,server,manifest,page,cosmetics,users,guilds,sellers}))check(n,fs.existsSync(f));
if(fs.existsSync(policy)){const s=fs.readFileSync(policy,'utf8');check('zero fee rule',s.includes('percentage = zeroFee ? 0 : 5'));check('HappyHomarid identifier',s.includes('HappyHomarid'));}
if(fs.existsSync(server)){const s=fs.readFileSync(server,'utf8');check('server imports marketplace policy',s.includes("require('./lib/marketplacePolicy')"));check('server imports Dreamiez routes',s.includes("require('./routes/dreamiez')"));check('checkout stamps seller metadata',s.includes("metadata[seller]"));check('webhook calculates marketplace fee',s.includes('calculateMarketplaceFee'));check('Dreamiez static route',s.includes("url.startsWith('/dreamiez/')"));}
if(fs.existsSync(cosmetics)){const c=JSON.parse(fs.readFileSync(cosmetics,'utf8'));check('15 cosmetics',c.length>=15);check('3 streak rewards',c.filter(x=>x.streak_reward).length>=3);}
if(fs.existsSync(manifest)){const m=JSON.parse(fs.readFileSync(manifest,'utf8'));check('Dreamiez manifest',m.silo_id==='SILO_DREAMIEZ');}
console.log(pass?'PASS marketplace + Dreamiez wiring':'FAIL marketplace + Dreamiez wiring');process.exit(pass?0:1);
