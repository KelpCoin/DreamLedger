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
console.log("BECK_VERCEL_FIGURE_EIGHT_CONTRACT=PASS",catalog.products.length,"existing catalogue rows");
