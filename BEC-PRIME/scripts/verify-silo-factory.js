'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const {buildOutputs}=require('../compiler/SiloCloneCompiler');
const out=buildOutputs();
for(const [rel,content] of Object.entries(out.files)){
 const p=path.join(ROOT,rel);
 assert(fs.existsSync(p),'missing generated file '+rel);
 assert.strictEqual(fs.readFileSync(p,'utf8'),content,'generated file drift '+rel);
}
const m=JSON.parse(fs.readFileSync(path.join(ROOT,'runtime/cube/silo-manifests/music-media.json'),'utf8'));
assert.strictEqual(m.silo_key,'MUSIC_MEDIA');
assert.strictEqual(m.platform_fee_bps,500);
assert.strictEqual(m.status,'build');
assert.strictEqual((m.products||[]).length,0);
console.log('PASS: CUBE silo factory output parity, isolation, fee policy, and fail-closed empty catalogue.');
