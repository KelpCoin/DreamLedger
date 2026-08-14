'use strict';
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const files=[
  path.join(root,'routes','dreamiez.js'),
  path.join(root,'silos','SILO_DREAMIEZ','compiled','website','account.html'),
  path.join(root,'compiled','website','assets','avatar-runtime.js'),
  path.join(root,'catalog','assets','shared-avatar-registry.json')
];
const forbidden=[
  'DEMAND_RADAR_PENDING','ELOHIM_REFINERY','PASS_FIXTURE','ComfyUI_PIPELINE_FIXTURE',
  'PROOF-','D:\\\\BrownEyeCortex','APPROVAL_GOVERNOR','GAUNTLET','TRI_LLM','TRUTH_ORACLE',
  'TREASURY_GOVERNOR','EVENT_SOURCED_LEDGER'
];
const checks={
  account_page:fs.existsSync(files[1]),
  account_create_route:fs.readFileSync(files[0],'utf8').includes('/api/dreamiez/account/create'),
  account_login_route:fs.readFileSync(files[0],'utf8').includes('/api/dreamiez/account/login'),
  account_route:fs.readFileSync(files[0],'utf8').includes("url==='/dreamiez/account'"),
  password_hashing:fs.readFileSync(files[0],'utf8').includes('scryptSync'),
  session_http_only:fs.readFileSync(files[0],'utf8').includes('HttpOnly'),
  public_registry_sanitized:true,
  public_runtime_sanitized:true
};
for(const f of files.slice(2)){
  const text=fs.readFileSync(f,'utf8');
  const hits=forbidden.filter(x=>text.includes(x));
  const key=f.includes('runtime')?'public_runtime_sanitized':'public_registry_sanitized';
  if(hits.length){checks[key]=false;console.error(key+' leaked: '+hits.join(', '));}
}
const failed=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
const proof={schema:'dreamledger/public-account-ip-boundary/v1',verdict:failed.length?'FAIL':'PASS',checks,failed,checked_files:files.map(f=>path.relative(root,f))};
const out=path.join(root,'data','proofs','PUBLIC-ACCOUNT-IP-BOUNDARY-PROOF.json');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof,null,2));
process.exit(failed.length?1:0);
