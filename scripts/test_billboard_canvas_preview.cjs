'use strict';
// No external requests, buyer data, payment intents, Stripe checkout or claims of inventory.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const preview=require('../public/assets/billboard-canvas-preview.js');

test('full million-pixel board has exactly one hundred independent 100x100 positions',()=>{
 assert.equal(preview.CELLS,100);
 assert.deepEqual(preview.coordinates(0),{col:0,row:0,x:0,y:0,width:100,height:100});
 assert.deepEqual(preview.coordinates(99),{col:9,row:9,x:900,y:900,width:100,height:100});
 assert.throws(()=>preview.coordinates(100),/INVALID_DEMO_CELL/);
});
test('no client-only demo ever overlays a confirmed PUBLISHED placement',()=>{
 const occupied=preview.publishedPositions([
  {status:'PUBLISHED',cell_index:0,title:'Actually approved'},
  {status:'PUBLISHED',cell_index:99,title:'Actual buyer'},
 ]);
 assert.equal(occupied.size,2);
 assert.equal(preview.choosePreview(0,occupied),null);
 assert.equal(preview.choosePreview(99,occupied),null);
 assert.equal(preview.choosePreview(51,occupied),51);
 assert.equal(preview.firstUnpublished(occupied),1);
});
test('duplicate, malformed, unpaid and out-of-range placements fail closed',()=>{
 assert.throws(()=>preview.publishedPositions([{status:'DRAFT',cell_index:10}]),/UNVERIFIED/);
 assert.throws(()=>preview.publishedPositions([{status:'PUBLISHED',cell_index:10},{status:'PUBLISHED',cell_index:10}]),/DUPLICATE/);
 assert.throws(()=>preview.publishedPositions([{status:'PUBLISHED',cell_index:100}]),/INVALID_PUBLISHED_POSITION/);
 assert.throws(()=>preview.choosePreview(-1,new Set()),/INVALID_DEMO_CELL/);
 assert.equal(preview.publishedPositions([{status:'PUBLISHED',cell_index:null}]).size,0);
 assert.equal(preview.firstUnpublished(new Set(Array.from({length:100},(_,i)=>i))),null);
});
test('text is capped, never executable or a fake paid receipt',()=>{
 assert.equal(preview.label('  '),'YOUR IDEA HERE');
 assert.equal(preview.label('X'.repeat(200)).length,80);
 assert.equal(preview.label('<script>steal</script>'),'<script>steal</script>');
 const page=read('public/billboard.html');
 assert(page.includes('label.textContent=preview.label(input.value)'), 'No use of raw HTML injection from visitor labels');
 assert(!page.includes('innerHTML=input.value'));
 assert(page.includes("badge.textContent='DEMO'"));
});
test('existing full grid renders, responds to click and keyboard, and distinguishes publication',()=>{
 const page=read('public/billboard.html');
 assert(page.includes('const cell=document.createElement(') && page.includes('for(let i=0;i<preview.CELLS;i++)'));
 assert(page.includes('id="billboard-canvas"'));
 assert(page.includes('id="preview-on-board"'));
 assert(page.includes('id="clear-board-preview"'));
 assert(page.includes('ArrowRight')&&page.includes('ArrowLeft')&&page.includes('ArrowUp')&&page.includes('ArrowDown'));
 assert(page.includes('role="grid"')&&page.includes("cell.setAttribute('role','gridcell')"));
 assert(page.includes('Published placement feed unavailable'));
 assert(page.includes("preview.publishedPositions(payload.items)"));
 assert(page.includes("cache:'no-store'"));
 assert(page.includes("cell.classList.add('is-published')"));
 assert(page.includes("cell.classList.add('is-demo')"));
 assert(page.includes('never listed as a purchased placement'));
 assert(page.toLowerCase().includes('checkout is held'));
 // Syntax-check all inline scripts without executing a DOM, fetch or payment gateway.
 for(const script of page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  if(script[1].trim())new vm.Script(script[1],{filename:'public/billboard.html'});
 }
});
test('historic buy route and founding product must not offer a bypass when checkout held',()=>{
 const page=read('public/billboard.html');
 const buy=read('public/buy/dreamledger-billboard-founding-001/index.html');
 const product=read('public/products/dreamledger-billboard-founding-001/index.html');
 assert(page.includes('Checkout temporarily held'));
 assert(!page.includes('https://buy.stripe.com/'));
 assert(!buy.includes('buy.stripe.com')&&!buy.includes('location.replace('));
 assert(buy.includes('Checkout')&&buy.includes('/billboard'));
 assert(!product.includes('href="/buy/dreamledger-billboard-founding-001/"'));
 assert(product.includes('https://schema.org/OutOfStock'));
 assert(product.includes('Checkout is temporarily held.'));
});
console.log('BILLBOARD_100_CELL_DEMO=PASS; REAL_PURCHASES=0; NO_LIVE_INVENTORY_TESTED');
