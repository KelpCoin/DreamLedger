'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');

const root=fs.mkdtempSync(path.join(os.tmpdir(),'dreamledger-marketplace-'));
process.env.DREAMIEZ_DATA_DIR=root;
const commerce=require('./MarketplaceCommerce');

const listings=commerce.paths.LISTINGS;
const orders=commerce.paths.ORDERS;
fs.mkdirSync(path.dirname(listings),{recursive:true});
fs.writeFileSync(listings,JSON.stringify([{
  id:'lst_test_1',seller_id:'seller_1',seller_name:'Seller',title:'Test Item',
  description:'Concurrency test',category:'General',price:100,quantity:1,reserved:0,sold:0,status:'APPROVED'
}],null,2));
fs.writeFileSync(orders,'[]');

test('cart reservation is idempotent',()=>{
  const first=commerce.reserveCart('buyer_1',[{listing_id:'lst_test_1',quantity:1}],'idem-1');
  const second=commerce.reserveCart('buyer_1',[{listing_id:'lst_test_1',quantity:1}],'idem-1');
  assert.equal(first.cart.id,second.cart.id);
  const rows=JSON.parse(fs.readFileSync(listings,'utf8'));
  assert.equal(rows[0].reserved,1);
});

test('second reservation cannot oversell inventory',()=>{
  assert.throws(
    ()=>commerce.reserveCart('buyer_2',[{listing_id:'lst_test_1',quantity:1}],'idem-2'),
    error=>error&&error.statusCode===409
  );
  const rows=JSON.parse(fs.readFileSync(listings,'utf8'));
  assert.equal(rows[0].reserved,1);
});

test('state lock is released after operation',()=>{
  const lock=commerce.paths.LISTINGS.replace('marketplace-listings.json','.marketplace-state.lock');
  assert.equal(fs.existsSync(lock),false);
});
