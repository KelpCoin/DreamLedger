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
assert.strictEqual(m.identity.slug,'music-media');
assert.strictEqual(m.silo_key,'MUSIC_MEDIA');
assert.strictEqual(m.platform_fee_bps,500);
assert.strictEqual(m.status,'build');
assert.strictEqual((m.products||[]).length,0);
const directory=JSON.parse(fs.readFileSync(path.join(ROOT,'data/silo-directory.json'),'utf8'));
assert.strictEqual(fs.readFileSync(path.join(ROOT,'data/silo-directory.json'),'utf8'),fs.readFileSync(path.join(ROOT,'public/data/silo-directory.json'),'utf8'),'directory mirrors differ');
assert(directory.silos.every(s=>s.status==='active'),'non-active silo leaked into public directory');
assert(!directory.silos.some(s=>s.key==='MUSIC_MEDIA'),'build-gated Music & Media leaked into active directory');
console.log('PASS: CUBE output parity, active-only directory, silo isolation, and fail-closed empty catalogue.');
