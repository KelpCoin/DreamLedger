'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {calculate}=require('../public/assets/seller-profit.js');
const sample={sale:100,buyerShipping:10,cost:40,platform:5,payment:2,fixedfee:0.3,shipping:9,packaging:1,feeBase:'total'};
test('buyer postage is revenue; seller postage is a cost',()=>{const r=calculate(sample);assert.equal(r.profit,52);assert.equal(r.cashRetained,92);assert.equal(r.platformFee,5.5);assert.equal(r.paymentFee,2.2);});
test('fees on item only and buyer pays no postage',()=>{assert.equal(calculate({...sample,feeBase:'item'}).profit,52.7);assert.equal(calculate({...sample,buyerShipping:0}).profit,42.7);});
test('loss, zero denominators and fixed fee',()=>{assert.equal(calculate({...sample,cost:120}).profit,-28);const r=calculate({...sample,sale:0,buyerShipping:0,cost:0});assert.equal(r.margin,null);assert.equal(r.roi,null);assert.equal(r.profit,-10.3);});
test('invalid or unknown inputs never silently become zero',()=>{for(const value of ['', ' ', -1, 'abc',Infinity,NaN,null])assert.throws(()=>calculate({...sample,sale:value}));assert.throws(()=>calculate({...sample,platform:101}));assert.throws(()=>calculate({...sample,feeBase:'guess'}));assert.throws(()=>calculate({...sample,sale:Number.MAX_VALUE,buyerShipping:Number.MAX_VALUE}));});
for(const path of ['seller-profit','nz-seller-profit']) test(`${path}: actual browser script updates output, blocks invalid download and exports`,()=>{
 const html=fs.readFileSync(`public/tools/${path}/index.html`,'utf8');
 const nodes={};for(const m of html.matchAll(/<(input|select|button|div|strong|p)\b[^>]*id="([^"]+)"[^>]*>/g)){const value=m[0].match(/value="([^"]*)"/);nodes[m[2]]={value:value?value[1]:'',textContent:'',addEventListener(type,fn){this[type]=fn;}};}
 nodes.feeBase.value='total';let blob,clicked=false,removed=false;
 const window={document:{getElementById:id=>nodes[id],body:{appendChild(){}},createElement:()=>({click(){clicked=true;},remove(){removed=true;}})},Blob:class {constructor(parts){blob=parts.join('');}},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout:fn=>fn()};
 vm.runInNewContext(fs.readFileSync('public/assets/seller-profit.js','utf8'),{window,Intl});
 Object.entries(sample).forEach(([k,v])=>nodes[k].value=String(v));nodes.sale.input();assert.match(nodes.profit.textContent,/52\.00/);
 nodes.download.click();assert.equal(JSON.parse(blob).estimates.profit,52);assert.equal(clicked,true);assert.equal(removed,true);
 nodes.sale.value='';nodes.sale.input();assert.equal(nodes.download.disabled,true);assert.equal(nodes.profit.textContent,'Unavailable');
 assert.doesNotMatch(html,/buy\.stripe\.com|seller-profit-lead|Email yourself|current fee preset/);
});
