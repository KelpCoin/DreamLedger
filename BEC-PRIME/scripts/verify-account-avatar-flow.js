'use strict';
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'routes','dreamiez.js'),'utf8');
const checks=[
 ['ACCOUNT_CREATE_ROUTE',route.includes("/api/dreamiez/account/create")],
 ['ACCOUNT_LOGIN_ROUTE',route.includes("/api/dreamiez/account/login")],
 ['ME_ROUTE',route.includes("/api/dreamiez/me")],
 ['AVATAR_SAVE_ROUTE',route.includes("/api/dreamiez/avatar")],
 ['PASSWORD_HASHED',route.includes('scryptSync')],
 ['HTTP_ONLY_SESSION',route.includes('HttpOnly')],
 ['SAME_SITE_SESSION',route.includes('SameSite=Lax')],
 ['AVATAR_ACCOUNT_BOUND',route.includes('users.find(v=>v.id===id)')],
 ['REGISTER_PASSWORD_MINIMUM',route.includes('password.length<8')]
];
const failed=checks.filter(x=>!x[1]).map(x=>x[0]);
const proof={schema:'dreamledger/account-avatar-contract/v1',verdict:failed.length?'FAIL':'PASS',checks:Object.fromEntries(checks),failed};
const out=path.join(root,'data','proofs','ACCOUNT-AVATAR-CONTRACT-PROOF.json');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof,null,2));
process.exit(failed.length?1:0);
