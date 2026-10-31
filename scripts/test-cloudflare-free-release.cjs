'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'..','public-release');
const get=p=>fs.readFileSync(path.join(dir,p),'utf8');
test('Cloudflare release has a real 404 and limited redirects',()=>{
 assert.match(get('404.html'),/Page unavailable/);
 assert.match(get('_headers'),/X-Content-Type-Options: nosniff/);
 const redirects=get('_redirects');
 assert.match(redirects,/\/billboard \/billboard.html 302/);
 assert.doesNotMatch(redirects,/buy\//);
});
test('zero-cost export retains three approved doors and demo',()=>{
 const home=get('index.html');
 for(const url of ['/mtg/','/avatar.html','/billboard.html'])
  assert.ok(home.includes('href="'+url+'"'),url);
 assert.match(get('billboard.html'),/data-demo-proof="visible-without-js"/);
 assert.equal((get('billboard.html').match(/data-index="[0-9]+"/g)||[]).length,100);
 assert.match(get('mtg/index.html'),/Wizards of the Coast Fan Content Policy/);
});
test('unapproved pages and unverified checkout are absent',()=>{
 const forbidden=['agent-bridge.html','truth-oracle.html','shop.html','buy/dreammeez-supporter-sprout/index.html','quote-compare-49.html'];
 for(const name of forbidden)assert.equal(fs.existsSync(path.join(dir,name)),false,'FORBIDDEN:'+name);
 const avatar=get('avatar.html');
 assert.match(avatar,/Purchases paused until secure delivery is available/);
 assert.doesNotMatch(avatar,/real.href =|Pay NZ\$3\.99/);
 const c=JSON.parse(get('catalog.json'));
 assert.ok(c.products.length>0);
 assert.ok(c.products.every(p=>p.checkout_available===false));
});
