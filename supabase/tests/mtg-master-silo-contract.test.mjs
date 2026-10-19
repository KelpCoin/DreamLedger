import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const read = (path) => readFileSync(resolve(repoRoot, path), "utf8");

test("entitlement migration removes client write permissions and write policies", () => {
  const sql = read("supabase/migrations/20261019000100_revoke_client_commerce_entitlement_writes.sql");
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /upper\(cmd\) in \('INSERT', 'UPDATE', 'DELETE', 'ALL'\)/i);
  assert.match(sql, /revoke insert, update, delete, truncate, references, trigger[\s\S]*from anon, authenticated/i);
  assert.match(sql, /commerce_item_ownership_self_read/);
  assert.match(sql, /revoke all privileges on table public\\.commerce_item_ownership from anon, authenticated/i);
  assert.match(sql, /grant select on table public\\.commerce_item_ownership to authenticated/i);
  assert.match(sql, /using \\(\\(select auth\\.uid\\(\\)\\) = user_id\\)/i);
  assert.doesNotMatch(sql, /create policy commerce_item_ownership_self_insert/i);
});

test("MTG catalog submissions are held as drafts for human review", () => {
  const source = read("supabase/functions/mtg-deck-catalog/index.ts");
  assert.match(source, /const publish = false;/);
  assert.match(source, /publication_status: "HELD_FOR_HUMAN_REVIEW"/);
  assert.match(source, /status: publish \? "published" : "draft"/);
  assert.match(source, /published_at: publish \? new Date\(\)\.toISOString\(\) : null/);
  assert.doesNotMatch(source, /const publish = body\.publish !== false;/);
});

test("public MTG catalog response does not expose the raw metadata object", () => {
  const source = read("supabase/functions/mtg-deck-catalog/index.ts");
  assert.match(source, /const decks = \(data \|\| \[\]\)\.map\(\(\{ metadata, \.\.\.deck \}\)/);
  assert.match(source, /slug: typeof metadata\?\.slug === "string" \? metadata\.slug : null/);
  assert.match(source, /metadata: \{ slug, publication_requires_human_approval: true \}/);
  assert.doesNotMatch(source, /metadata: \{ uploader_email:/);
});

test("clone contract remains held until independent commerce evidence exists", () => {
  const contract = JSON.parse(read("docs/MTG-MASTER-SILO-CLONE-READINESS.json"));
  assert.equal(contract.readiness, "NOT_CLONE_READY");
  assert.equal(contract.decision, "HOLD_NEW_PRODUCTION_CLONES");
  assert.equal(contract.economic_truth.verified_external_revenue_nzd, 0);
  assert.equal(contract.side_effects.live_payments_performed, false);
  assert.ok(contract.promotion_gates.length >= 10);
  assert.match(contract.release_rule, /UNKNOWN is not PASS/);
});

test("a held Commander diagnostic is not sold by a hardcoded public Stripe link", () => {
  const product = JSON.parse(read("BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json"));
  assert.equal(product.status, "held");
  assert.equal(product.checkout.mode, "disabled");
  assert.equal(product.commercial_truth.sellable, false);
  for (const path of [
    "BEC-PRIME/website/mtg-catalog.html",
    "BEC-PRIME/compiled/website/mtg/index.html"
  ]) {
    const html = read(path);
    assert.doesNotMatch(html, /buy\.stripe\.com/i, path + " must not bypass the held offer contract");
    assert.match(html, /HELD · checkout disabled/, path + " must show the held state");
  }
});

test("held diagnostic and conflicted EDH_0001 cannot advertise active payment links", () => {
  const offers = JSON.parse(read("BEC-PRIME/catalog/offers/approved.json"));
  const active = (offers.approved || []).find(x => x && x.offer_id === "OFFER-CMD-DIAG-29-NZD");
  assert.equal(active, undefined, "held diagnostic must not remain in the approved offer list");
  const offer = (offers.held || []).find(x => x && x.offer_id === "OFFER-CMD-DIAG-29-NZD");
  assert.ok(offer);
  assert.equal(offer.status, "HELD_NOT_RELEASED");
  assert.equal(offer.approval_required, true);
  assert.equal(offer.checkout_available, false);
  assert.notEqual(offer.payment_link_status, "ACTIVE_LIVEMODE");
  assert.equal(Object.hasOwn(offer, "payment_link_url"), false);
  assert.equal(Object.hasOwn(offer, "payment_link_id"), false);

  const product = JSON.parse(read("BEC-PRIME/catalog/products/EDH_0001.json"));
  assert.equal(product.status, "held");
  assert.equal(product.inventory, 0);
  assert.equal(product.checkout.mode, "disabled");
  assert.equal(product.commercial_truth.sellable, false);
  assert.equal(product.commercial_truth.approval_required, true);
  assert.equal(Object.hasOwn(product, "payment_link"), false);
  assert.equal(Object.hasOwn(product, "payment_link_id"), false);
});

test("all checkout and discovery projections fail closed for held MTG offers", () => {
  const readJson = (path) => JSON.parse(read(path));

  const product = readJson("BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json");
  assert.equal(product.status, "held");
  assert.equal(product.inventory, 0);
  assert.equal(product.commercial_truth.sellable, false);
  assert.equal(product.checkout.mode, "disabled");
  assert.equal(Object.hasOwn(product.commercial_truth, "payment_link"), false);

  const featured = readJson("BEC-PRIME/catalog/featured-offer.json");
  assert.equal(featured.status, "HELD_NOT_RELEASED");
  assert.equal(featured.public_visibility, "hidden");
  assert.equal(Object.hasOwn(featured, "payment_link_url"), false);
  assert.equal(featured.checkout_route, null);

  const generated = readJson("BEC-PRIME/catalog/offers/offers.json");
  const generatedDiag = generated.offers.find(x => x.offer_id === "OFFER-CMD-DIAG-29-NZD");
  assert.ok(generatedDiag);
  assert.equal(generatedDiag.status, "HELD_NOT_RELEASED");
  assert.equal(generatedDiag.checkout_available, false);
  assert.equal(Object.hasOwn(generatedDiag, "payment_link_url"), false);

  const projected = readJson("BEC-PRIME/catalog/offers/products.json");
  for (const id of ["COMMANDER-DECK-DIAGNOSTIC-001", "EDH_0001"]) {
    const item = projected.offers.find(x => x.offer_id === id);
    assert.ok(item, "missing projection: " + id);
    assert.equal(item.checkout_available, false);
    assert.equal(item.checkout_route, null);
    assert.equal(item.checkout_url || null, null);
    assert.equal(item.approval_required, true);
  }
  assert.match(read("BEC-PRIME/compiler/ProductCompiler.js"), /checkout_url: checkoutAvailable \?\s*\(p\.commercial_truth\?\.payment_link \|\| null\) : null/);
  assert.match(read("BEC-PRIME/compiler/ProductCompiler.js"), /p\.commercial_truth\?\.sellable === true/);

  const legacyApproved = readJson("BEC-PRIME/catalog/offers.json");
  const legacyDiag = legacyApproved.offers.find(x => x.offer_id === "OFFER-COMMANDER-DECK-DIAGNOSTIC-001");
  assert.ok(legacyDiag);
  assert.equal(legacyDiag.status, "HELD_NOT_RELEASED");
  assert.equal(legacyDiag.checkout_available, false);
  assert.equal(Object.hasOwn(legacyDiag, "payment_link"), false);

  const featuredStub = readJson("BEC-PRIME/featured-offer.json");
  assert.equal(featuredStub.payment_link_status, "HELD_NOT_RELEASED");
  assert.equal(featuredStub.checkout_available, false);

  const live = readJson("BEC-PRIME/catalog/commerce-live.json");
  const activeDiag = live.offers.find(x => x.offer_id === "OFFER-CMD-DIAG-29-NZD");
  assert.ok(activeDiag);
  assert.equal(activeDiag.status, "HELD_NOT_RELEASED");
  assert.equal(activeDiag.checkout, null);

  const activeLinks = readJson("commerce/marketing/ACTIVE-PAYMENT-LINKS.json");
  assert.equal(activeLinks.links.some(x => ["COMMANDER-DECK-DIAGNOSTIC-001", "EDH_0001"].includes(x.product_id)), false);
  assert.equal(activeLinks.held_links.some(x => x.product_id === "COMMANDER-DECK-DIAGNOSTIC-001"), true);
  assert.equal(activeLinks.held_links.some(x => x.product_id === "EDH_0001"), true);

  const commerceCatalog = readJson("catalog/commerce-catalog.json");
  const commerceDiag = commerceCatalog.products.find(x => x.id === "COMMANDER-DECK-DIAGNOSTIC-001");
  assert.equal(commerceDiag.status, "held");
  assert.equal(commerceDiag.checkout_available, false);
  assert.equal(Object.hasOwn(commerceDiag, "stripe_payment_link"), false);

  for (const path of ["public/.well-known/agent-commerce.json", "public/agent-commerce.json"]) {
    const feed = readJson(path);
    const diagnostic = feed.primary_offers.find(x => x.product_id === "COMMANDER-DECK-DIAGNOSTIC-001");
    const edh = feed.primary_offers.find(x => x.product_id === "EDH_0001");
    assert.ok(diagnostic, "missing diagnostic entry in " + path);
    assert.ok(edh, "missing EDH_0001 entry in " + path);
    assert.equal(diagnostic.checkout_available, false);
    assert.equal(diagnostic.checkout_url, null);
    assert.equal(diagnostic.buy_router, null);
    assert.equal(edh.checkout_available, false);
    assert.equal(edh.checkout_url, null);
    assert.equal(edh.buy_router, null);
  }

  const publicOffers = read("public/offers.html");
  assert.doesNotMatch(publicOffers, /href=["']\/buy\/COMMANDER-DECK-DIAGNOSTIC-001/i);
  assert.match(publicOffers, /Held · not for sale/);

  const silo = readJson("data/mtg-catalog.json");
  const publicSilo = readJson("public/data/mtg-catalog.json");
  assert.deepEqual(publicSilo, silo);
  const edhItem = silo.products.find(x => x.id === "EDH_0001");
  assert.equal(edhItem.status, "held");
  assert.equal(edhItem.checkout_available, false);
  assert.equal(edhItem.inventory, 0);

  const publicCatalog = readJson("public/catalog.json");
  const publicEdh = publicCatalog.products.find(x => x.id === "EDH_0001");
  assert.equal(publicEdh.status, "held");
  assert.equal(publicEdh.checkout_available, false);
  assert.equal(publicEdh.inventory, 0);
});
