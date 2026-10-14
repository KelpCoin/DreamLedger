const fs = require("node:fs");
const assert = require("node:assert/strict");
const read = (path) => fs.readFileSync(path, "utf8");

const root = read("index.html");
const published = read("public/index.html");
const css = read("dreamledger.css");
const publicCss = read("public/dreamledger.css");
const marketplace = read("marketplace.html");
const publicMarketplace = read("public/marketplace.html");
const truthOracle = read("truth-oracle.html");
const publicTruthOracle = read("public/truth-oracle.html");
const vercel = read("vercel.json");

assert.equal(root, published, "root and public homepage copies must be byte-identical");
assert.equal(css, publicCss, "root and public stylesheet copies must be byte-identical");
assert.match(vercel, /copyFileSync\('index\.html','public\/index\.html'\)/, "build must publish canonical root homepage");
for (const [path, content] of [["index.html", root], ["marketplace.html", marketplace], ["truth-oracle.html", truthOracle]]) {
  assert.match(content, /href="\/dreamledger\.css"/, path + " must load the root-published shared stylesheet");
}
assert.match(root, /href="\/truth-oracle\.html"/, "homepage must expose Truth Oracle");
assert.match(root, /href="\/mtg\/"/, "homepage must expose the MTG silo");
assert.match(root, /href="\/privacy\.html"/, "privacy link must resolve");
assert.match(root, /href="\/terms\.html"/, "terms link must resolve");
assert.match(root, /Paid automated report delivery is not advertised as live/, "homepage must not overstate paid fulfillment");
assert.match(root, /VERIFIED EXTERNAL REVENUE: NZ\$0\.00/, "homepage must preserve verified revenue baseline");
assert.match(marketplace, /Current offer status/, "live marketplace route must show canonical availability");
assert.doesNotMatch(marketplace, /buy\.stripe\.com/, "marketplace must not expose unverified paid checkout links");
assert.match(marketplace, /VERIFIED_EXTERNAL_REVENUE = NZ\$0\.00/, "marketplace must preserve verified revenue baseline");
assert.match(publicMarketplace, /Current offer status/, "public mirror must match the availability policy");
assert.match(truthOracle, /not represented as an automated or paid live service/, "Truth Oracle must not imply paid delivery is live");
assert.match(publicTruthOracle, /not represented as an automated or paid live service/, "public Truth Oracle mirror must state paid delivery status");
for (const path of [
  "mtg/index.html",
  "trust/index.html",
  "quote-comparison/index.html",
  "privacy.html",
  "terms.html",
  "security.html",
  "about.html"
]) {
  const content = read(path);
  assert.match(content, /href="\/dreamledger\.css"/, path + " must use shared design tokens");
}
console.log("SITE_CONSOLIDATION_CONTRACT PASS");
console.log("Published/root source parity: PASS");
console.log("Shared design system on live root routes: PASS");
console.log("No unverified marketplace checkout links: PASS");
console.log("Paid capability and revenue labels: PASS");
