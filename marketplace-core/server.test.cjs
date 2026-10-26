'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),os=require('node:os'),fs=require('node:fs'),path=require('node:path');
process.env.MARKETPLACE_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'dreamledger-marketplace-'));
process.env.MARKETPLACE_ADMIN_TOKEN='test_admin_secret';
const {server,db}=require('./server.cjs');
let root;
test.before(async()=>{await new Promise(ok=>server.listen(0,'127.0.0.1',ok));root='http://127.0.0.1:'+server.address().port});
test.after(async()=>{await new Promise(ok=>server.close(ok));db.close();fs.rmSync(process.env.MARKETPLACE_DATA_DIR,{recursive:true,force:true})});
async function call(route,method='GET',body,token,admin){const headers={};if(body)headers['content-type']='application/json';if(token)headers.authorization='Bearer '+token;if(admin)headers['x-marketplace-admin-token']=process.env.MARKETPLACE_ADMIN_TOKEN;const r=await fetch(root+route,{method,headers,body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}}
test('health and no fabricated inventory',async()=>{assert.equal((await call('/api/health')).data.ok,true);assert.deepEqual((await call('/api/listings')).data.listings,[])});
test('public storefront serves responsive UI, styles and interactive client',async()=>{const h=await fetch(root+'/');assert.equal(h.status,200);assert.match(await h.text(),/Discover something extraordinary/);const css=await fetch(root+'/marketplace.css');assert.equal(css.status,200);assert.match(css.headers.get('content-type'),/text\/css/);const js=await fetch(root+'/marketplace.js');assert.equal(js.status,200);assert.match(await js.text(),/register-form/);assert.match(h.headers.get('content-security-policy'),/script-src 'self'/)});
test('register, moderate, bid and billboard capacity',async()=>{
const s=await call('/api/register','POST',{email:'seller@example.org'});assert.equal(s.status,201);
const b=await call('/api/register','POST',{email:'bidder@example.org'});assert.equal(b.status,201);
const l=await call('/api/listings','POST',{title:'Vintage lamp',category:'Home',description:'Original lamp',kind:'auction',price:500,ends:Date.now()+3600000},s.data.token);assert.equal(l.status,201);
assert.equal((await call('/api/listings')).data.listings.length,0);
const review=await call('/api/admin/review','POST',{table:'listings',id:l.data.id,action:'approve'},null,true);assert.equal(review.status,200);
assert.equal((await call('/api/listings')).data.listings.length,1);
const bid=await call('/api/listings/'+l.data.id+'/bid','POST',{amount:600},b.data.token);assert.equal(bid.status,201);assert.equal(bid.data.paymentCaptured,false);
assert.equal((await call('/api/listings/'+l.data.id+'/bid','POST',{amount:700},s.data.token)).status,409);
const p=await call('/api/billboard','POST',{market:'NZ',units:25,title:'Seller',url:'https://example.org'},s.data.token);assert.equal(p.status,201);
const q=await call('/api/admin/review','POST',{table:'placements',id:p.data.id,action:'approve'},null,true);assert.equal(q.status,200);
const markets=await call('/api/markets');assert.equal(markets.data.occupied[0].units,25);
assert.equal((await call('/api/admin/queue')).status,403);
});