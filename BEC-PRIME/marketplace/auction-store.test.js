'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const http = require('node:http');
const crypto = require('node:crypto');
const { AuctionStore } = require('./auction-store');
const { createHandler } = require('../routes/userAuctions');
const listing = (now, overrides = {}) => ({ inventory_id: 'copy-1', category: 'mtg', title: 'Test fixture only', description: 'Not sale inventory', start_minor: 1000, increment_minor: 50, starts_at: now - 1000, ends_at: now + 600000, ...overrides });
function setup(t) { let now = 1000000; const s = new AuctionStore(':memory:', () => now); t.after(() => s.close()); return { s, now, advance: v => { now += v; } }; }
function approved(s, now, overrides) { const a = s.create('seller', listing(now, overrides), crypto.randomUUID()); s.approve(a.auction_id, 'reviewer'); return a.auction_id; }
test('drafts private; same copy cannot have two active auctions; seller scoped copies', t => {
 const { s, now } = setup(t); const x = listing(now); const a = s.create('seller', x, 'request-00000001');
 assert.equal(s.list().length, 0); assert.throws(() => s.get(a.auction_id, 'other'), /NOT_FOUND/);
 assert.deepEqual(s.create('seller', x, 'request-00000001'), a);
 assert.throws(() => s.create('seller', x, 'request-00000002'), /INVENTORY_ALREADY/);
 assert.ok(s.create('another', x, 'request-00000003'));
});
test('integer money and category isolation', t => { const { s, now } = setup(t);
 assert.throws(() => s.create('seller', listing(now, { start_minor: 1.5 }), 'request-00000001'), /INVALID/);
 assert.throws(() => s.create('seller', listing(now, { category: 'adult' }), 'request-00000001'), /INVALID/);
});
test('first bid at start, self-bid forbidden, increment, replay and changed replay', t => {
 const { s, now } = setup(t); const id = approved(s, now);
 assert.throws(() => s.bid(id, 'seller', 1000, 'request-00000001'), /SELF_BID/);
 const r = s.bid(id, 'buyer', 1000, 'request-00000001'); assert.equal(r.amount_minor, 1000);
 assert.deepEqual(s.bid(id, 'buyer', 1000, 'request-00000001'), r);
 assert.throws(() => s.bid(id, 'buyer', 1100, 'request-00000001'), /IDEMPOTENCY_CONFLICT/);
 assert.throws(() => s.bid(id, 'buyer2', 1000, 'request-00000001'), /BELOW_MINIMUM/);
 assert.equal(s.bid(id, 'buyer2', 1050, 'request-00000001').status, 'accepted');
 assert.equal(s.get(id).bid_count, 2);
});
test('future and expired bids rejected; views never restart ended auction', t => {
 const { s, now, advance } = setup(t); const id = approved(s, now, { starts_at: now + 10000 });
 assert.throws(() => s.bid(id, 'buyer', 1000, 'request-00000001'), /NOT_OPEN/);
 advance(700000); const a = s.get(id); assert.equal(a.status, 'ended');
 assert.equal(s.list()[0].ends_at, a.ends_at);
 assert.throws(() => s.bid(id, 'buyer', 1000, 'request-00000001'), /NOT_OPEN/);
});
test('anti-sniping extends; close creates exactly one unpaid order and locks stock', t => {
 const { s, now, advance } = setup(t); const id = approved(s, now, { ends_at: now + 60000 });
 assert.equal(s.bid(id, 'buyer', 1000, 'request-00000001').ends_at, now + 120000);
 assert.throws(() => s.closeAuction(id), /NOT_ENDED/); advance(120001);
 assert.equal(s.closeAuction(id).status, 'awaiting_payment'); s.closeAuction(id);
 const orders = s.orders('buyer'); assert.equal(orders.length, 1); assert.equal(orders[0].status, 'payment_pending'); assert.equal(orders[0].platform_fee_minor, 0);
 assert.equal(s.orders('stranger').length, 0);
 assert.throws(() => s.create('seller', listing(now + 120001), 'request-00000002'), /INVENTORY_ALREADY/);
});
test('reserve not met creates no order; seller cannot cancel after a bid', t => {
 const { s, now, advance } = setup(t); const id = approved(s, now, { reserve_minor: 2000 });
 s.bid(id, 'buyer', 1000, 'request-00000001'); assert.throws(() => s.cancel(id, 'seller'), /CANNOT_CANCEL/);
 advance(700000); assert.equal(s.closeAuction(id).status, 'unsold'); assert.equal(s.orders('buyer').length, 0);
});
test('secure session expires and logout revokes token', t => {
 const { s, advance } = setup(t); const token = s.session('buyer'); assert.equal(s.authenticate(token), 'buyer');
 assert.equal(s.authenticate('buyer'), null); s.logout(token); assert.equal(s.authenticate(token), null);
 const second = s.session('buyer'); advance(3600001); assert.equal(s.authenticate(second), null);
});
test('concurrent database connections accept only one equal bid and survive reopen', async t => {
 const dir = mkdtempSync(path.join(tmpdir(), 'auction-race-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
 const filename = path.join(dir, 'auction.sqlite'), s = new AuctionStore(filename); const id = approved(s, Date.now()); s.close();
 const gate = new SharedArrayBuffer(4);
 const workerCode = `const {parentPort,workerData}=require('node:worker_threads'); const {AuctionStore}=require(workerData.module); const s=new AuctionStore(workerData.file); parentPort.postMessage('ready'); Atomics.wait(new Int32Array(workerData.gate),0,0); try{parentPort.postMessage({ok:true,result:s.bid(workerData.id,workerData.buyer,1000,'request-00000001')});}catch(e){parentPort.postMessage({ok:false,error:e.message});}finally{s.close();}`;
 const workers = ['buyer1','buyer2'].map(buyer => new Worker(workerCode, { eval: true, workerData: { module: require.resolve('./auction-store'), file: filename, id, buyer, gate } }));
 const results = workers.map(w => new Promise((resolve,reject) => { w.on('message', m => { if(m !== 'ready') resolve(m); }); w.on('error',reject); }));
 await Promise.all(workers.map(w => new Promise((resolve,reject) => { w.once('message',resolve); w.once('error',reject); })));
 Atomics.store(new Int32Array(gate),0,1); Atomics.notify(new Int32Array(gate),0);
 const r = await Promise.all(results); assert.equal(r.filter(x=>x.ok).length,1); assert.match(r.find(x=>!x.ok).error,/BELOW_MINIMUM/);
 const reopened = new AuctionStore(filename); assert.equal(reopened.get(id).bid_count,1); reopened.close();
});
test('HTTP: existing password -> secure session -> draft -> reviewer -> bid; spoofed identity denied', async t => {
 const { s, now } = setup(t); const dir = mkdtempSync(path.join(tmpdir(),'auction-http-')); t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const salt = crypto.randomBytes(16).toString('hex'); const users = ['seller','buyer','reviewer'].map(id=>({id,email:id+'@example.invalid',password:{salt,hash:crypto.scryptSync('fixture-passphrase',salt,64).toString('hex')}}));
 const usersFile = path.join(dir,'users.json'); writeFileSync(usersFile,JSON.stringify(users));
 const route = createHandler({store:s,usersFile,reviewers:['reviewer'],origin:'http://localhost'});
 const server = http.createServer(async(req,res)=>{await route(req,res,new URL(req.url,'http://localhost').pathname);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 async function call(url,token,data,extra={}) {const r=await fetch(base+url,{method:data?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...extra},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json()};}
 const login=async name=>(await call('/api/auctions/session',null,{email:name+'@example.invalid',password:'fixture-passphrase'})).body.token;
 const seller=await login('seller'),buyer=await login('buyer'),reviewer=await login('reviewer'); assert.ok(seller&&buyer&&reviewer);
 assert.equal((await call('/api/auctions',null,listing(now),{cookie:'dreamiez_session=seller'})).status,401);
 const a=await call('/api/auctions',seller,listing(now),{'idempotency-key':'request-00000001'}); assert.equal(a.status,201);
 const prefix='/api/auctions/'+a.body.auction_id;
 assert.equal((await call(prefix+'/approve',seller,{})).status,403);
 assert.equal((await call(prefix+'/approve',reviewer,{})).status,200);
 assert.equal((await call(prefix+'/bids',buyer,{amount_minor:1000,bidder_id:'seller'},{'idempotency-key':'request-00000001'})).status,400);
 assert.equal((await call(prefix+'/bids',buyer,{amount_minor:1000},{'idempotency-key':'request-00000001',origin:'https://evil.invalid'})).status,403);
 assert.equal((await call(prefix+'/bids',buyer,{amount_minor:1000},{'idempotency-key':'request-00000001'})).status,200);
});
test('auction page parses, matches compiled artifact and never fabricates lots', () => {
 const fs=require('node:fs'),vm=require('node:vm'); const html=fs.readFileSync(path.join(__dirname,'../../public/auctions.html'),'utf8');
 const compiled=fs.readFileSync(path.join(__dirname,'../compiled/website/auctions.html'),'utf8'); assert.equal(html,compiled);
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.ok(scripts.length);scripts.forEach(s=>new vm.Script(s[1]));
 assert.ok(!html.includes('AUC-MTG-FETCHLAND-001')); assert.ok(!/localStorage\s*\./.test(html)); assert.ok(!html.includes('innerHTML'));
 const legacy=require('../auction-engine'); assert.deepEqual(legacy.listAuctions(),[]);assert.throws(()=>legacy.placeBid('x','y',10),/RETIRED/);
});
test('HTTP route defaults disabled rather than falling through to unsafe legacy endpoints', async () => {
 const route=require('../routes/userAuctions'); const saved=process.env.USER_AUCTIONS_ENABLED;delete process.env.USER_AUCTIONS_ENABLED;
 try {let status,out;const res={writeHead:s=>{status=s;},end:s=>{out=JSON.parse(s);}};
 assert.equal(await route.handle({method:'POST'},res,'/api/auctions'),true);assert.equal(status,503);assert.equal(out.error,'USER_AUCTIONS_NOT_ENABLED');
 }finally{if(saved!==undefined)process.env.USER_AUCTIONS_ENABLED=saved;}
});
