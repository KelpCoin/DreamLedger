#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteArg = process.argv.indexOf("--site-root");
const siteRoot = siteArg >= 0 ? path.resolve(process.argv[siteArg + 1] || "") : null;
const readJson = p => JSON.parse(fs.readFileSync(p, "utf8"));
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const hasNumericPrice = p => typeof p.price === "number" && Number.isFinite(p.price);
const mustNotAdvertisePrice = (p, label) => {
  assert.equal(hasNumericPrice(p), false, label + " must not publish a numeric price");
  assert.equal(p.price_status, "UNOBSERVABLE", label + " must mark price UNOBSERVABLE");
  assert.equal(p.checkout_available, false, label + " checkout must be disabled");
  assert.equal(own(p, "checkout_url"), false, label + " must not expose checkout_url");
};
const sitePath = (...parts) => path.join(siteRoot || repoRoot, ...parts);
const rootCatalogue = readJson(sitePath("data", "mtg-catalog.json"));
const publicCatalogue = readJson(siteRoot
  ? sitePath("catalog.json")
  : path.join(repoRoot, "public", "catalog.json"));
const find = (doc, id) => (doc.products || []).find(p => p.id === id);
const rootEdh = find(rootCatalogue, "EDH_0001");
const publicEdh = find(publicCatalogue, "EDH_0001");
const rootDiagnostic = find(rootCatalogue, "COMMANDER-DECK-DIAGNOSTIC-001");
const publicDiagnostic = find(publicCatalogue, "COMMANDER-DECK-DIAGNOSTIC-001");

assert.ok(rootEdh, "root MTG catalogue must contain EDH_0001 in held state");
assert.ok(publicEdh, "public catalogue must contain EDH_0001 in held state");
for (const [p, label] of [[rootEdh, "root EDH_0001"], [publicEdh, "public EDH_0001"]]) {
  assert.notEqual(p.status, "published", label + " must not be published");
  mustNotAdvertisePrice(p, label);
  assert.equal(p.price_evidence_status, "UNVERIFIED", label + " evidence must remain unverified");
}
assert.equal(rootEdh.sale_mode, "held_review", "root EDH_0001 must be held for review");
assert.equal(rootEdh.inventory, 0, "root EDH_0001 held inventory must be zero");
assert.equal(own(rootEdh, "claim_url"), false, "root EDH_0001 must not expose a claim route");
assert.equal(own(rootEdh, "detail_url"), false, "root EDH_0001 must not expose a detail route that might show the old price");
assert.equal(publicEdh.availability, "held_review", "public EDH_0001 must be held for review");
assert.equal(own(publicEdh, "patron_price_nzd"), false, "public EDH_0001 must not expose a patron price");
assert.doesNotMatch(publicEdh.description || "", /NZ\$\s*(230|400)/i, "public EDH_0001 description must not repeat stale prices");

for (const [p, label] of [[rootDiagnostic, "root Commander Diagnostic"], [publicDiagnostic, "public Commander Diagnostic"]]) {
  assert.ok(p, label + " must exist");
  assert.notEqual(p.status, "published", label + " must remain held");
  mustNotAdvertisePrice(p, label);
  assert.equal(p.inventory, 0, label + " inventory must remain zero");
  assert.equal(own(p, "payment_link_url"), false, label + " must not publish payment_link_url");
  assert.equal(own(p, "payment_link_id"), false, label + " catalogue must not publish Payment Link id");
  assert.equal(own(p, "stripe_price_id"), false, label + " must not publish Stripe price id");
  assert.equal(own(p, "stripe_product_id"), false, label + " must not publish Stripe product id");
}

const offer = readJson(path.join(repoRoot, "BEC-PRIME", "catalog", "featured-offer.json"));
assert.equal(offer.public_visibility, "held", "featured diagnostic offer must remain held");
assert.equal(offer.payment_link_status, "DEACTIVATION_REQUIRED_UNCONFIRMED", "do not claim the external Stripe link is disabled without proof");
assert.equal(offer.evidence_status, "not_released", "diagnostic offer must not be released");
assert.equal(offer.checkout_route, "held_no_checkout", "diagnostic checkout route must remain disabled");
assert.equal(own(offer, "price"), false, "held offer must not advertise a price");
for (const field of ["payment_link_url", "checkout_url", "fulfillment_route", "stripe_price_id", "stripe_product_id"]) {
  assert.equal(own(offer, field), false, "held featured offer must not expose " + field);
}
assert.ok(offer.payment_link_id, "keep an operator lookup id so deactivation can be completed");

const mtgPages = siteRoot
  ? [path.join(siteRoot, "mtg", "index.html")]
  : [path.join(repoRoot, "mtg", "index.html"), path.join(repoRoot, "public", "mtg", "index.html")];
for (const p of mtgPages) {
  const html = fs.readFileSync(p, "utf8");
  assert.match(html, /var FALLBACK = \[\];/, "MTG page fallback must be empty: " + p);
  assert.doesNotMatch(html, /render\(\s*FALLBACK\s*,/, "MTG page must not display hardcoded fallback inventory: " + p);
  assert.doesNotMatch(html, /id:\s*['"]EDH_0001['"][\s\S]{0,500}price:\s*400/, "MTG page must not hardcode old EDH_0001 price: " + p);
  assert.match(html, /offline fallback intentionally contains no prices or checkout links/i, "MTG empty state must explain why no fallback listing appears: " + p);
}
console.log(JSON.stringify({
  status: "PASS",
  checks: [
    "EDH_0001 held and price UNOBSERVABLE in root and public catalogues",
    "Commander Diagnostic held, no public price/link metadata",
    "Featured offer held; remote Stripe deactivation truthfully remains unconfirmed",
    "MTG HTML pages have no hardcoded inventory fallback",
    "site_root: " + (siteRoot || "(source files)")
  ]
}, null, 2));
