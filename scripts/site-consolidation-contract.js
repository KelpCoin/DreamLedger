"use strict";

const fs = require("node:fs");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const read = (path) => fs.readFileSync(path, "utf8");

// Exercise the real Vercel build path, not a guessed output layout.
execFileSync(process.execPath, ["scripts/build-vercel-site.js"], { stdio: "inherit" });

const root = read("index.html");
const built = read("dist/index.html");
const css = read("dreamledger.css");
const publicCss = read("public/dreamledger.css");
const marketplace = read("marketplace.html");
const publicMarketplace = read("public/marketplace.html");
const truthOracle = read("truth-oracle.html");
const publicTruthOracle = read("public/truth-oracle.html");
const mtg = read("mtg/index.html");
const publicMtg = read("public/mtg/index.html");
const vercel = read("vercel.json");

assert.equal(root, built, "Vercel output must use canonical root homepage");
assert.equal(css, publicCss, "root and public shared stylesheet copies must be byte-identical");
assert.equal(fs.existsSync("public/index.html"), false, "public/index.html must not compete with the canonical homepage");
assert.match(vercel, /"buildCommand":\s*"node scripts\/build-vercel-site\.js"/, "Vercel must use the deterministic build script");
assert.match(vercel, /"outputDirectory":\s*"dist"/, "Vercel must publish the clean dist directory");
assert.doesNotMatch(vercel, /"deploymentEnabled":\s*false/, "Git deployments must not be globally disabled");

for (const [path, content] of [["index.html", root], ["marketplace.html", marketplace], ["truth-oracle.html", truthOracle]]) {
  assert.match(content, /href="\/dreamledger\.css"/, path + " must load the shared stylesheet");
}
assert.match(root, /href="\/truth-oracle\.html"/, "homepage must expose Truth Oracle");
assert.match(root, /href="\/mtg\/"/, "homepage must expose the MTG silo");
assert.match(root, /VERIFIED EXTERNAL REVENUE: NZ\$0\.00/, "homepage must preserve verified revenue baseline");
assert.match(root, /Paid automated report delivery is not advertised as live/, "homepage must not overstate paid fulfillment");

assert.match(marketplace, /Current offer status/, "live marketplace route must show canonical availability");
assert.doesNotMatch(marketplace, /buy\.stripe\.com/, "marketplace must not expose unverified paid checkout links");
assert.match(marketplace, /VERIFIED_EXTERNAL_REVENUE = NZ\$0\.00/, "marketplace must preserve verified revenue baseline");
assert.match(publicMarketplace, /Current offer status/, "public mirror must preserve the availability policy");

assert.match(truthOracle, /Billy|billy\.govt\.nz/, "Truth Oracle must surface the free national power comparator");
assert.match(truthOracle, /grocer\.nz/, "Truth Oracle must surface the free/low-cost grocery comparator");
assert.match(truthOracle, /Same evidence standard for every tier/, "Truth Oracle must keep verdict rules consistent across tiers");
assert.match(publicTruthOracle, /billy\.govt\.nz/, "public Truth Oracle copy must align with the savings-first proposition");

assert.equal(mtg, publicMtg, "Render and Vercel MTG routes must use the same source");
assert.match(mtg, /patreon\.com\/happyhomarid/, "MTG silo must signpost HappyHomarid Patreon");
assert.match(mtg, /id="live"/, "MTG silo must contain the live chat surface");
assert.match(mtg, /id="forum"/, "MTG silo must contain the classic forum surface");
assert.match(mtg, /id="inbox"/, "MTG silo must contain private conversations");
assert.doesNotMatch(mtg, /Commander diagnostic.{0,80}NZ\$29/i, "MTG silo must not be dominated by the diagnostic upsell");
assert.doesNotMatch(mtg, /Light Play|Lightly Played/, "MTG silo must not invent card condition labels");

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
console.log("Single canonical homepage and Vercel build output: PASS");
console.log("Shared design system and route parity: PASS");
console.log("MTG community, Patreon, and condition safeguards: PASS");
console.log("Truth Oracle savings-first positioning and truthful commerce labels: PASS");
