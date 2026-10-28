'use strict';
// BECK Gauntlet -> bounded deterministic Elohim safety fix -> reviewed PR.
// Only auction-engine and auction UI are whitelisted. Never auto-deploy.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..');
const ENGINE=path.join(ROOT,'BEC-PRIME/auction-engine.js');
const PAGE=path.join(ROOT,'public/auctions.html');
const OUT=process.env.BECK_MARKETPLACE_PROOF||path.join(ROOT,'proof/marketplace/self-build.json');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function diagnose(engine,page){
 const a=[];
 if(!engine.includes("AUTHENTICATED_NEON_BID_EXECUTOR_REQUIRED"))a.push('UNVERIFIED_BID_EXECUTOR');
 if(/a\.ends_at\s*=\s*t\s*\+/.test(engine))a.push('EXPIRED_AUCTION_REANIMATION');
 if(/checkout_available:\s*a.checkout_available/.test(engine))a.push('UNVERIFIED_CHECKOUT_EXPOSURE');
 if(!engine.includes("a.seller_verified === true")||!engine.includes("a.gauntlet_verdict === 'ALLOW'"))a.push('SELLER_GAUNTLET_UNBOUND');
 if(/\bdemoLots\b|\blocalStorage\.|\bsessionStorage\./.test(page))a.push('SYNTHETIC_BROWSER_AUCTION');
 if(!page.includes('disabled>Bidding unavailable pending verified checkout'))a.push('BID_UI_NOT_FAIL_CLOSED');
 return a;
}
function repairSources(engine,page){
 let e=engine,h=page;
 const bidStart=e.indexOf('function placeBid('),refresh=e.indexOf('function refreshExpired(');
 if(bidStart>=0&&refresh>bidStart)e=e.slice(0,bidStart)+
  "function placeBid() {\n  throw new Error('AUTHENTICATED_NEON_BID_EXECUTOR_REQUIRED');\n}\n"+e.slice(refresh);
 const refreshStart=e.indexOf('function refreshExpired('),exportStart=e.indexOf('module.exports',refreshStart);
 if(refreshStart>=0&&exportStart>refreshStart){
  const replacement=[
   "function listAuctions(silo) {",
   "  const state = loadState();",
   "  return state.auctions.filter(a =>",
   "    (!silo || a.silo===silo) && a.approved === true &&",
   "    a.seller_verified === true && a.gauntlet_verdict === 'ALLOW' &&",
   "    a.status === 'APPROVED' && Number(a.ends_at)>now()",
   "  ).map(a => publicAuction(a,state.bids));",
   "}",
   "function getAuction(id) {return listAuctions().find(a=>a.auction_id===id)||null;}",
   ""
  ].join('\n');
  e=e.slice(0,refreshStart)+replacement+e.slice(exportStart);
 }
 e=e.replace(/checkout_available:\s*a\.checkout_available\s*===\s*true\s*&&\s*status\s*!==\s*'ended'\s*&&\s*reserveMet/,
 "checkout_available: false, seller_verified: a.seller_verified === true, approved: a.approved === true, gauntlet_verdict: a.gauntlet_verdict === 'ALLOW' ? 'ALLOW' : 'HOLD'");
 if(/\bdemoLots\b|\blocalStorage\.|\bsessionStorage\./.test(h)){
  const x=h.lastIndexOf('<script>'),y=h.lastIndexOf('</script>');
  if(x>=0&&y>x){
   const replacement=[
    "<script>",
    "'use strict';",
    "document.getElementById('lots').textContent='No verified auction lots are available. Bidding is held.';",
    "document.getElementById('ticker-track').textContent='No synthetic lots or bids';",
    "document.getElementById('lots').insertAdjacentHTML('beforeend','<button disabled>Bidding unavailable pending verified checkout</button>');",
    "</script>"
   ].join('\n');
   h=h.slice(0,x)+replacement+h.slice(y+9);
  }
 }
 return {engine:e,page:h};
}
function run(repair=false){
 const origEngine=fs.readFileSync(ENGINE,'utf8'),origPage=fs.readFileSync(PAGE,'utf8');
 const before=diagnose(origEngine,origPage),changed=[];
 if(repair&&before.length){
  const output=repairSources(origEngine,origPage);
  if(diagnose(output.engine,output.page).length===0){
   if(output.engine!==origEngine){fs.writeFileSync(ENGINE,output.engine);changed.push('BEC-PRIME/auction-engine.js');}
   if(output.page!==origPage){fs.writeFileSync(PAGE,output.page);changed.push('public/auctions.html');}
  }
 }
 const after=diagnose(fs.readFileSync(ENGINE,'utf8'),fs.readFileSync(PAGE,'utf8'));
 const report={
  schema:'BECK/MARKETPLACE-SELF-BUILD/v1',verdict:after.length?'HOLD':'PASS',
  before,after,patch_candidate_files:changed,
  source_hashes:{engine:sha(origEngine),page:sha(origPage)},
  gauntlet_verified:after.length===0,elohim_bounded_repairs:changed.length,
  auto_merge:false,public_publish_authorized:false,payment_authorized:false,
  live_bidding_authorized:false,revenue_verified:false,
  mode:repair?'BOUNDED_REPAIR':'READ_ONLY_AUDIT'
 };
 report.proof_sha256=sha(JSON.stringify(report));
 fs.mkdirSync(path.dirname(OUT),{recursive:true});
 fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
 console.log('BECK_MARKETPLACE_GAUNTLET='+report.verdict+' CANDIDATE_FILES='+changed.length);
 if(after.length)process.exitCode=1;
 return report;
}
if(require.main===module)run(process.argv.includes('--repair'));
module.exports={diagnose,repairSources,run};