'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8'),json=p=>JSON.parse(read(p));
const {build}=require('../compiler/SiloCloneCompiler'),out=build();
for(const [rel,content] of Object.entries(out)){const p=path.join(ROOT,rel);assert(fs.existsSync(p),'missing generated file '+rel);assert.strictEqual(read(rel),content,'generated file drift '+rel);}
const master=json('silos/mtg/silo.json'),media=json('silos/music-media/silo.json'),dir=json('data/silo-directory.json'),reg=json('docs/BECK-EMPIRE-SILO-REGISTRY.json');
assert.strictEqual(master.identity.slug,'mtg');assert.strictEqual(master.inventory_policy.allow_invented_products,false);
assert.strictEqual(media.identity.slug,'music-media');assert.strictEqual(media.inventory_policy.allow_invented_products,false);
assert.strictEqual(read('public/mtg/index.html').includes('innerHTML'),false,'master must not render untrusted data through innerHTML');
assert.strictEqual(read('public/music-media/index.html'),read('public/mtg/index.html').replace('data-silo="mtg"','data-silo="music-media"'),'clone must be the MTG master shell with only the slug replaced');
assert.strictEqual(read('data/silo-directory.json'),read('public/data/silo-directory.json'),'directory mirrors differ');
assert(dir.silos.every(x=>x.status==='active'),'non-active silo leaked into public directory');
assert(!dir.silos.some(x=>x.key==='MUSIC_MEDIA'),'build-gated Music & Media leaked into active directory');
assert(!Object.keys(reg.silos).some(k=>k.startsWith('TCG_')),'candidate TCG ideas became registered silos');
assert(!fs.existsSync(path.join(ROOT,'runtime/cube/templates/silo-index.html')),'parallel generic silo template must not exist');
assert(!fs.existsSync(path.join(ROOT,'runtime/cube/templates/tcg-silo-index.html')),'parallel TCG template must not exist');
console.log(JSON.stringify({schema:'DREAMLEDGER/CUBE-MTG-MASTER-GAUNTLET/v1',verdict:'PASS_WITH_HOLDS',checks:['deterministic output parity','manifest isolation','safe DOM renderer','active-only directory','no parallel templates','no TCG idea activation'],holds:['capability readiness and commercial evidence are still required before activation']},null,2));
