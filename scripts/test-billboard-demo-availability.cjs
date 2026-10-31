'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../public/billboard.html'),'utf8');
test('billboard first-screen demo is visible without JS',()=>{
 assert.match(html,/data-demo-proof="visible-without-js"/);
 assert.match(html,/EXAMPLE ONLY/);
 assert.match(html,/Customize yours below/);
 assert.match(html,/Try the interactive demo/);
});
test('100 static grid squares are present, without fake purchasers',()=>{
 const cells=html.match(/data-index="\d+"/g)||[];
 assert.equal(cells.length,100);
 assert.match(html,/aria-label="Preview position 45, selected"/);
 assert.match(html,/<noscript>/);
 assert.match(html,/canvas\.replaceChildren\(\);/);
 assert.doesNotMatch(html,/checkout_available:true|window\.location\.assign\(.*stripe/i);
});
test('interactive script parses and includes safe local export',()=>{
 const blocks=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.ok(blocks.length>0);
 for(const b of blocks)if(b[1].trim())new vm.Script(b[1],{filename:'public/billboard.html'});
 assert.match(html,/URL\.createObjectURL/);
 assert.match(html,/toDataURL\("image\/png"\)/);
 assert.match(html,/New purchases temporarily held/);
 assert.match(html,/not physical roadside DOOH/i);
});
