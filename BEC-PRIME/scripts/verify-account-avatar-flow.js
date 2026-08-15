'use strict';
const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'routes','dreamiez.js'),'utf8');
const login=fs.readFileSync(path.join(root,'compiled','website','login.html'),'utf8');
const register=fs.readFileSync(path.join(root,'compiled','website','register.html'),'utf8');
const checks=[
 ['ACCOUNT_CREATE_ROUTE',route.includes("/api/dreamiez/account/create")],
 ['ACCOUNT_LOGIN_ROUTE',route.includes("/api/dreamiez/account/login")],
 ['ACCOUNT_REGISTER_ALIAS',route.includes("/api/account/register")],
 ['ACCOUNT_LOGIN_ALIAS',route.includes("/api/account/login")],
 ['EMAIL_VERIFICATION_ROUTE',route.includes("/api/dreamiez/account/verify")],
 ['RESEND_VERIFICATION_ROUTE',route.includes("/api/dreamiez/account/resend-verification")],
 ['VERIFIED_EMAIL_REQUIRED_FOR_SELLING',route.includes("u.email_verified!==true")&&route.includes("/api/marketplace/listings")],
 ['ME_ROUTE',route.includes("/api/dreamiez/me")],
 ['ACCOUNT_ME_ALIAS',route.includes("/api/account/me")],
 ['ACCOUNT_LOGOUT_ROUTE',route.includes("/api/dreamiez/account/logout")],
 ['AVATAR_SAVE_ROUTE',route.includes("/api/dreamiez/avatar")],
 ['AVATAR_BODY_RANGE',route.includes("Math.min(4,b.build)")&&route.includes("Math.min(4,b.height)")],
 ['AVATAR_SKIN_RANGE',route.includes("Math.min(9,b.skin)")],
 ['PASSWORD_HASHED',route.includes('scryptSync')],
 ['HTTP_ONLY_SESSION',route.includes('HttpOnly')],
 ['SAME_SITE_SESSION',route.includes('SameSite=Lax')],
 ['ACCOUNT_BOUND_AVATAR',route.includes('users.find(x=>x.id===id)')],
 ['REGISTER_PASSWORD_MINIMUM',route.includes('password.length<8')],
 ['LOGIN_DOES_NOT_BLOCK_UNVERIFIED_ACCOUNT',!route.includes("if(found.email_verified!==true)return json(res,403")],
 ['REGISTER_USES_PRIMARY_ACCOUNT_API',register.includes('/api/account/register')&&!register.includes('/api/dreamiez/account/create')],
 ['LOGIN_USES_PRIMARY_ACCOUNT_API',login.includes('/api/account/login')&&!login.includes('/api/dreamiez/account/login')],
 ['LOGIN_SAME_ORIGIN_CREDENTIALS',login.includes("credentials:'same-origin'")||login.includes("credentials:'include'")],
 ['REGISTER_SAME_ORIGIN_CREDENTIALS',register.includes("credentials:'same-origin'")||register.includes("credentials:'include'")],
 ['EMAIL_PROVIDER_OPTIONAL_FOR_ACCOUNT_CREATION',route.includes('verification_error=err.message')&&route.includes('verification_sent')]
];
const failed=checks.filter(x=>!x[1]).map(x=>x[0]);
const proof={schema:'dreamledger/account-avatar-contract/v4',verdict:failed.length?'FAIL':'PASS',checks:Object.fromEntries(checks),failed,generated_at:new Date().toISOString()};
const out=path.join(root,'data','proofs','ACCOUNT-AVATAR-CONTRACT-PROOF.json');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof,null,2));
process.exit(failed.length?1:0);
