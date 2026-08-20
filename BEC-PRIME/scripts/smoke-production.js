'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const base = (process.env.SMOKE_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
const PRODUCT_ID = 'EDH_0001';
async function request(path, options = {}) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000); try { const response = await fetch(`${base}${path}`, { redirect:'follow', cache:'no-store', signal:controller.signal, ...options }); const text = await response.text(); let body=null; try { body=JSON.parse(text); } catch (_) {} return {response,text,body}; } finally { clearTimeout(timer); } }
(async()=>{
  const health=await request('/healthz'); assert.equal(health.response.status,200,`healthz HTTP ${health.response.status}`);
  const loginPage=await request('/login.html'); assert.equal(loginPage.response.status,200,`login page HTTP ${loginPage.response.status}`); assert.match(loginPage.text,/\/api\/account\/login/); assert.match(loginPage.text,/Dreamiez is optional/); assert.doesNotMatch(loginPage.text,/\/api\/dreamiez\/account\/login/);
  const registerPage=await request('/register.html'); assert.equal(registerPage.response.status,200,`register page HTTP ${registerPage.response.status}`); assert.match(registerPage.text,/\/api\/account\/register/); assert.doesNotMatch(registerPage.text,/\/api\/dreamiez\/account\/create/);
  const accountPage=await request('/account.html'); assert.equal(accountPage.response.status,200,`account page HTTP ${accountPage.response.status}`); assert.match(accountPage.text,/\/api\/account\//);
  const anonymous=await request('/api/account/me'); assert.equal(anonymous.response.status,200); assert.equal(anonymous.body?.authenticated,false,'anonymous main account must not be authenticated');
  const smokeEmail=`production-main-account-${crypto.randomUUID()}@example.test`; const smokePassword='DreamLedgerProduction!2026';
  const created=await request('/api/account/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:smokeEmail,password:smokePassword,name:'Production Main Account Smoke'})});
  assert.equal(created.response.status,201,`main account registration HTTP ${created.response.status}`); assert.equal(created.body?.ok,true); assert.equal(created.body?.account?.avatar,null,'main account must not require an avatar');
  const cookie=created.response.headers.get('set-cookie'); assert.ok(cookie&&cookie.includes('dreamiez_session='));
  const session=await request('/api/account/me',{headers:{cookie}}); assert.equal(session.body?.authenticated,true); assert.equal(session.body?.account?.email,smokeEmail); assert.equal(session.body?.account?.avatar,null);
  const login=await request('/api/account/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:smokeEmail,password:smokePassword})}); assert.equal(login.response.status,200,`main account login HTTP ${login.response.status}`); assert.equal(login.body?.ok,true); const loginCookie=login.response.headers.get('set-cookie'); assert.ok(loginCookie&&loginCookie.includes('dreamiez_session='));
  const loggedIn=await request('/api/account/me',{headers:{cookie:loginCookie}}); assert.equal(loggedIn.body?.authenticated,true); assert.equal(loggedIn.body?.account?.email,smokeEmail);
  const badLogin=await request('/api/account/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:smokeEmail,password:'wrong-password'})}); assert.equal(badLogin.response.status,401);
  const logout=await request('/api/account/logout',{method:'POST',headers:{cookie:loginCookie}}); assert.equal(logout.response.status,200);
  const afterLogout=await request('/api/account/me',{headers:{cookie:loginCookie}}); assert.equal(afterLogout.body?.authenticated,false);
  const product=await request(`/api/products/${PRODUCT_ID}`); assert.equal(product.response.status,200,`EDH_0001 HTTP ${product.response.status}`); assert.equal(product.body?.id,PRODUCT_ID); assert.equal(product.body?.price,40000); assert.equal(String(product.body?.currency).toLowerCase(),'nzd'); assert.equal(product.body?.inventory,1); assert.equal(product.body?.status,'published'); assert.equal(product.body?.approval_required,false); assert.equal(product.body?.checkout_available,true);
  console.log(JSON.stringify({status:'PASS',base,primary_account:{registration:true,login:true,logout:true,anonymous_not_authenticated:true,avatar_optional:true},edh_0001:{id:product.body.id,price:product.body.price,currency:product.body.currency,inventory:product.body.inventory,status:product.body.status,approval_required:product.body.approval_required,checkout_available:product.body.checkout_available}},null,2));
})().catch(err=>{console.error(JSON.stringify({status:'FAIL',base,error:err.name==='AbortError'?'request timeout after 15s':err.message},null,2));process.exit(1);});
