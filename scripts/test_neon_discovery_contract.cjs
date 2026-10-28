// Offline source contract, not proof of live commercial transactions.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const site=read("public/index.html"),go=read("public/go/index.html"),market=read("public/marketplace.html"),server=read("public/server.js"),bill=read("public/billboard.html"),theme=read("public/assets/bec-neon.css"),script=read("public/assets/discovery.js");
assert(server.includes("'/':'index.html'"),"production root must use designed storefront");
assert(server.includes("'/go':'go/index.html'"),"preserve canonical QR doorway route");
assert(server.includes("/api/discovery/catalog")&&server.includes("/api/discovery/silos"),"reuse catalog and registry");
for(const [name,p] of [["index",site],["go",go],["market",market]]){assert(p.includes("/assets/bec-neon.css"),name+" must use shared billboard visual tokens");assert(p.includes("Browse Everything")||p.includes("Browse everything"),name+" must expose broad catalogue");}
assert(theme.includes("#c5ff35")&&theme.includes("Space Grotesk"),"neon billboard design contract");
assert(market.includes("data-bec-catalog")&&market.includes("/assets/discovery.js"),"marketplace must use existing read-only discoverability");
assert(script.includes("checkout_available")&&script.includes("buy.stripe.com"),"checkout affordance must be gated to known live links");
assert(bill.includes("billboard-canvas")&&bill.includes("100")&&bill.includes("live-items"),"full billboard grid and honest feed required");
assert(bill.includes("DEMO ONLY")&&bill.includes("/api/billboard/public"),"demo not paid placement");
console.log("BECK_NEON_DISCOVERY_CONTRACT=PASS");
