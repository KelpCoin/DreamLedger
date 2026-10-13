'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const {build}=require('../compiler/SiloCloneCompiler');
const out=build();
for(const [rel,content] of Object.entries(out)){
 const p=path.join(ROOT,rel);
 assert(fs.existsSync(p),'missing generated file '+rel);
 assert.strictEqual(fs.readFileSync(p,'utf8'),content,'generated file drift '+rel);
}
const m=JSON.parse(fs.readFileSync(path.join(ROOT,'silos/music-media/silo.json'),'utf8'));
const legacy=JSON.parse(fs.readFileSync(path.join(ROOT,'runtime/cube/silo-manifests/music-media.json'),'utf8'));
assert.strictEqual(legacy.status,'deprecated');
assert.strictEqual(legacy.canonical_manifest,'silos/music-media/silo.json');
assert.strictEqual(m.identity.slug,'music-media');
assert.strictEqual(m.silo_key,'MUSIC_MEDIA');
assert.strictEqual(m.platform_fee_bps,500);
assert(['build','development','active'].includes(m.status),'invalid silo release state');
const products=m.products||[];
if(m.status==='build')assert.strictEqual(products.length,0,'build-gated silo must start empty');
if(m.status==='active'){
 assert(products.some(p=>p&&p.status==='published'),'active silo requires at least one published listing');
 for(const p of products.filter(p=>p&&p.status==='published'))assert(p.silo==='music-media'&&p.rights_status==='verified'&&p.delivery_status==='verified'&&p.checkout_available===true&&typeof p.checkout_url==='string'&&/^https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+$/.test(p.checkout_url),'active listing lacks verified rights, delivery, or checkout');
}
const directory=JSON.parse(fs.readFileSync(path.join(ROOT,'data/silo-directory.json'),'utf8'));
assert.strictEqual(fs.readFileSync(path.join(ROOT,'data/silo-directory.json'),'utf8'),fs.readFileSync(path.join(ROOT,'public/data/silo-directory.json'),'utf8'),'directory mirrors differ');
assert(directory.silos.every(s=>s.status==='active'),'non-active silo leaked into public directory');
const listed=directory.silos.some(s=>s.key==='MUSIC_MEDIA');
if(m.status==='active')assert(listed,'active Music & Media missing from directory');
else assert(!listed,'build/development Music & Media leaked into active directory');
console.log('PASS: CUBE output parity, active-only directory, silo isolation, and fail-closed empty catalogue.');
