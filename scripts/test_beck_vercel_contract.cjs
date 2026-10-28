/* No external calls, no payment mutation. Validate current Vercel production release substrate. */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const v=JSON.parse(read("vercel.json")),index=read("public/index.html"),go=read("public/go/index.html"),market=read("public/marketplace.html"),board=read("public/billboard.html"),api=read("api/[...route].ts"),handler=read("handlers/discovery.js"),published=read("handlers/billboard-public.js");
assert.equal(v.outputDirectory,"public");
for(const page of [index,go,market]){assert(page.includes("/assets/bec-neon.css"));assert(/Browse Everything|Browse everything/.test(page));}
assert(index.includes("#")===false||index.includes("DREAMLEDGER"));
assert(index.includes("DreamLedger Originals")&&index.includes("c5ff35")===false||index.includes("bec-neon.css"));
assert(api.includes("/api/discovery/catalog")&&api.includes("/api/discovery/silos"));
assert(read("api/discovery/catalog.ts").includes("handlers/discovery.js"));
assert(read("api/discovery/silos.ts").includes("handlers/discovery.js"));
assert(handler.includes("public/catalog.json")&&handler.includes("CUBE-SILO-REGISTRY.json"));
assert(market.includes("data-bec-catalog")&&market.includes("/assets/discovery.js"));
assert(board.includes('id="billboard-canvas"')&&board.includes('DEMO ONLY')&&board.includes("/api/billboard/public"));
assert(published.includes("payment_verified")&&published.includes("moderation_status")&&published.includes("cell_index"));
assert(read("public/assets/bec-neon.css").includes("#c5ff35"));
assert(!index.includes("/buy/COMMANDER-DECK-DIAGNOSTIC-001"));
const catalog=JSON.parse(read("public/catalog.json"));assert(catalog.schema==="dreamledger/public-catalogue/v1");
// Evidence-backed quote payment link; billboard stays held pending publication proof.
const quote=catalog.products.find(p=>p.id==="QUOTE-COMPARE-49");
const billboardOffer=catalog.products.find(p=>p.id==="DREAMLEDGER-BILLBOARD-FOUNDING-001");
assert(quote && quote.price===49 && quote.currency==="nzd" && quote.checkout_available===true);
assert.equal(quote.checkout_url,"https://buy.stripe.com/00wdR93vnbK5eqH3gwdwc3r");
assert.equal(quote.payment_link_id,"plink_1USpJeEGgEAnUFF9vNDiM8SS");
assert(billboardOffer && billboardOffer.price===50 && billboardOffer.checkout_available===false);
assert.equal(billboardOffer.checkout_url,null);
assert(index.includes('href="/quote-compare-49.html"'));
const quoteLanding=read("public/quote-compare-49.html");
assert(quoteLanding.includes("/assets/bec-neon.css") && quoteLanding.includes(quote.checkout_url));
assert(quoteLanding.includes("Dreamledger.org@gmail.com") && quoteLanding.includes("Manual review"));
assert(read("handlers/discovery.js").includes("offer_page:offerPage"));
assert(read("public/assets/discovery.js").includes("View offer and purchase details"));
assert(market.includes('href="/quote-compare-49.html"') && !market.includes("PAID CHECKOUT HELD"));
assert(board.includes("id=\"billboard-canvas\""));
console.log("BECK_VERCEL_FIGURE_EIGHT_CONTRACT=PASS",catalog.products.length,"existing catalogue rows");
