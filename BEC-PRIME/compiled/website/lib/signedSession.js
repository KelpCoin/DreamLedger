'use strict';
const crypto = require('node:crypto');
const MAX_AGE_SECONDS = 7*24*60*60;
const USER_RE = /^u_[a-f0-9]{24}$/;
function validSecret(value) { return typeof value==='string' && Buffer.byteLength(value,'utf8')>=32; }
function sign(accountId, secret, now=Math.floor(Date.now()/1000)) {
  if (!validSecret(secret) || !USER_RE.test(String(accountId))) throw Error('SECURE_SESSION_UNAVAILABLE');
  const claims = { v:1, sub:accountId, iat:now, exp:now+MAX_AGE_SECONDS, nonce:crypto.randomBytes(16).toString('hex') };
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const mac = crypto.createHmac('sha256',secret).update('v1.'+body).digest('hex');
  return 'v1.'+body+'.'+mac;
}
function verify(token,secret,now=Math.floor(Date.now()/1000)) {
  if (!validSecret(secret) || typeof token!=='string' || token.length>1500) return null;
  const pieces=token.split('.');
  if (pieces.length!==3 || pieces[0]!=='v1' || !/^[A-Za-z0-9_-]+$/.test(pieces[1]) || !/^[0-9a-f]{64}$/.test(pieces[2])) return null;
  const expected=crypto.createHmac('sha256',secret).update('v1.'+pieces[1]).digest();
  const actual=Buffer.from(pieces[2],'hex');
  if(actual.length!==expected.length || !crypto.timingSafeEqual(actual,expected)) return null;
  let claims;
  try { claims=JSON.parse(Buffer.from(pieces[1],'base64url').toString('utf8')); }
  catch { return null; }
  if(!claims || claims.v!==1 || !USER_RE.test(claims.sub) || !Number.isSafeInteger(claims.iat) ||
    !Number.isSafeInteger(claims.exp) || !/^[0-9a-f]{32}$/.test(claims.nonce||'') ||
    claims.iat>now+60 || claims.exp<=now || claims.exp-claims.iat!==MAX_AGE_SECONDS) return null;
  return claims.sub;
}
function fromCookie(header,secret) {
  const found=String(header||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('dreamiez_session='));
  if(!found) return null;
  try{return verify(decodeURIComponent(found.slice('dreamiez_session='.length)),secret);}
  catch{return null;}
}
module.exports={sign,verify,fromCookie,MAX_AGE_SECONDS};
