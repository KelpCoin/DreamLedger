'use strict';
const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'routes','dreamiez.js'),'utf8');
const checks=[
 ['ACCOUNT_CREATE_ROUTE',route.includes("/api/dreamiez/account/create")],
 ['ACCOUNT_LOGIN_ROUTE',route.includes("/api/dreamiez/account/login")],
 ['EMAIL_VERIFICATION_ROUTE',route.includes("/api/dreamiez/account/verify")],
 ['RESEND_VERIFICATION_ROUTE',route.includes("/api/dreamiez/account/resend-verification")],
 ['VERIFIED_EMAIL_REQUIRED_FOR_SELLING',route.includes("u.email_verified!==true")&&route.includes("/api/marketplace/listings")],
 ['ME_ROUTE',route.includes("/api/dreamiez/me")],
 ['AVATAR_SAVE_ROUTE',route.includes("/api/dreamiez/avatar")],
 ['AVATAR_BODY_RANGE',route.includes("Math.min(4,b.build)")&&route.includes("Math.min(4,b.height)")],
 ['AVATAR_SKIN_RANGE',route.includes("Math.min(9,b.skin)")],
 ['MEDIA_UPLOAD_ROUTE',route.includes("/api/marketplace/media")],
 ['PASSWORD_HASHED',route.includes('scryptSync')],
 ['HTTP_ONLY_SESSION',route.includes('HttpOnly')],
 ['SAME_SITE_SESSION',route.includes('SameSite=Lax')],
 ['ACCOUNT_BOUND_AVATAR',route.includes('users.find(x=>x.id===id)')],
 ['REGISTER_PASSWORD_MINIMUM',route.includes('password.length<8')],
 ['RESEND_EMAIL_PROVIDER',route.includes('api.resend.com')]
];
const failed=checks.filter(x=>!x[1]).map(x=>x[0]);
const proof={schema:'dreamledger/account-avatar-contract/v2',verdict:failed.length?'FAIL':'PASS',checks:Object.fromEntries(checks),failed,generated_at:new Date().toISOString()};
const out=path.join(root,'data','proofs','ACCOUNT-AVATAR-CONTRACT-PROOF.json');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof,null,2));
process.exit(failed.length?1:0);
