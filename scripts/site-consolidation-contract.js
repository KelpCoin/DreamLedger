const fs = require("node:fs");
const assert = require("node:assert/strict");

const read = (path) => fs.readFileSync(path, "utf8");
const root = read("index.html");
const published = read("public/index.html");
const css = read("public/dreamledger.css");
const marketplace = read("public/marketplace.html");
const truthOracle = read("public/truth-oracle.html");
const vercel = read("vercel.json");

assert.equal(root, published, "root index.html and public/index.html must be byte-identical");
assert.match(vercel, /copyFileSync\('index\.html','public\/index\.html'\)/, "build must publish the canonical root homepage");
assert.match(root, /href="\/dreamledger\.css"/, "homepage must load shared design tokens");
assert.match(root, /href="\/truth-oracle\.html"/, "homepage must expose Truth Oracle");
assert.match(root, /href="\/mtg\/"/, "homepage must expose the MTG silo");
assert.match(root, /href="\\/privacy\\.html"/, "homepage privacy link must resolve to the published page");
assert.match(root, /href="\\/terms\\.html"/, "homepage terms link must resolve to the published page");
assert.match(root, /Paid automated report delivery is not advertised as live/, "homepage must not overstate paid fulfillment");
assert.match(css, /--dl-bg:/, "shared stylesheet must define canonical color tokens");
assert.match(css, /font-family:Inter/, "shared stylesheet must define canonical typography");

for (const path of [
  "public/marketplace.html",
  "public/truth-oracle.html",
  "public/mtg/index.html",
  "public/quote-comparison/index.html",
  "public/trust/index.html"
  "public/privacy.html",
  "public/terms.html",
  "public/security.html",
  "public/about.html"
]) {
  assert.match(read(path), /href="\/dreamledger\.css"/, path + " must use shared design tokens");
}

assert.match(marketplace, /Paid comparison and report fulfillment remain held/, "marketplace must clearly label paid fulfillment status");
assert.match(marketplace, /VERIFIED_EXTERNAL_REVENUE = NZ\$0\.00/, "marketplace must preserve the verified revenue baseline");
assert.match(truthOracle, /structured paid-report and delivery workflow is not advertised as live/, "Truth Oracle must not imply unverified paid delivery");
console.log("SITE_CONSOLIDATION_CONTRACT PASS");
console.log("Canonical homepage parity: PASS");
console.log("Shared visual system on core routes: PASS");
console.log("Paid capability and marketplace truth labels: PASS");
