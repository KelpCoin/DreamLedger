'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8'),json=p=>JSON.parse(read(p));
const {build}=require('../compiler/SiloCloneCompiler');
const dirs=fs.readdirSync(path.join(ROOT,'silos'),{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name!=='mtg'&&fs.existsSync(path.join(ROOT,'silos',d.name,'silo.json'))).map(d=>'silos/'+d.name+'/silo.json').sort();
assert(dirs.length>0,'at least one manifest-backed candidate is required');
for(const manifest of dirs){const m=json(manifest),slug=m.identity.slug;assert.notStrictEqual(slug,'mtg','MTG is master only');const out=build(manifest);for(const [rel,content] of Object.entries(out)){assert(fs.existsSync(path.join(ROOT,rel)),'missing generated file '+rel);assert.strictEqual(read(rel),content,'generated file drift '+rel);}const c=json('data/'+slug+'-catalog.json');assert.strictEqual(c.silo,slug);assert.deepStrictEqual(c.products,[],'candidate catalogue must start empty');assert.strictEqual(read('public/'+slug+'/index.html'),read('public/mtg/index.html').replace('data-silo="mtg"','data-silo="'+slug+'"'));}
const master=json('silos/mtg/silo.json'),dir=json('data/silo-directory.json'),reg=json('docs/BECK-EMPIRE-SILO-REGISTRY.json');
assert.strictEqual(master.identity.slug,'mtg');assert.strictEqual(master.identity.platform_fee_bps,0);assert.strictEqual(read('public/mtg/index.html'),read('mtg/index.html'));
assert(!read('public/mtg/index.html').includes('innerHTML'),'master must not render untrusted data through innerHTML');
assert.strictEqual(read('data/silo-directory.json'),read('public/data/silo-directory.json'),'directory mirrors differ');
assert(dir.silos.every(x=>x.status==='active'),'non-active silo leaked into public directory');
assert(!dir.silos.some(x=>x.key==='MUSIC_MEDIA'),'build-gated Music & Media leaked into active directory');
assert(!Object.keys(reg.silos).some(k=>k.startsWith('TCG_')),'candidate TCG ideas became registered silos');
assert(!fs.existsSync(path.join(ROOT,'runtime/cube/templates/silo-index.html')),'parallel generic silo template must not exist');
assert(!fs.existsSync(path.join(ROOT,'runtime/cube/templates/tcg-silo-index.html')),'parallel TCG template must not exist');
console.log(JSON.stringify({schema:'DREAMLEDGER/CUBE-MTG-MASTER-GAUNTLET/v1',verdict:'PASS_WITH_HOLDS',candidate_manifests:dirs,inventory_policy:'empty',active_directory:dir.silos.map(x=>x.key),holds:['capability readiness and commercial evidence are required before activation']},null,2));
