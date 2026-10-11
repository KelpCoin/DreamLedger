import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(here, "../public/catalog.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const products = catalog.products;
const mtgProducts = products.filter((p) => p.category === "mtg" || p.silo === "mtg");
const byId = (id) => products.find((p) => p.id === id);

test("catalogue has a product array and unique product IDs", () => {
  assert.ok(Array.isArray(products) && products.length > 0);
  const ids = products.map((p) => p.id);
  assert.ok(ids.every((id) => typeof id === "string" && id.length > 0));
  assert.equal(new Set(ids).size, ids.length, "duplicate product id");
});

test("MTG SKUs are unique and each enabled checkout has an HTTPS URL", () => {
  const skus = mtgProducts.map((p) => p.sku).filter(Boolean);
  assert.equal(new Set(skus).size, skus.length, "duplicate MTG SKU");
  for (const product of mtgProducts) {
    if (product.checkout_available === true) {
      assert.equal(product.status, "published", `${product.id} checkout enabled while not published`);
      assert.match(product.checkout_url ?? "", /^https:\/\//, `${product.id} needs an HTTPS checkout URL`);
    }
    if (product.checkout_available === false) {
      assert.ok(product.checkout_url == null || product.checkout_url === "", `${product.id} has checkout disabled but a URL remains`);
    }
  }
});

test("Edward Kenway catalogue price matches the confirmed NZD 400 offer", () => {
  const product = byId("EDH_0001");
  assert.ok(product, "Edward Kenway listing missing");
  assert.equal(product.category, "mtg");
  assert.equal(product.currency, "nzd");
  assert.equal(product.price, 400);
  assert.equal(product.checkout_available, true);
  assert.equal(product.checkout_url, "https://buy.stripe.com/14A3cvea1dSd1DV5oEdwc1J");
});

test("Commander Deck Diagnostic catalogue offer remains NZD 29", () => {
  const product = byId("COMMANDER-DECK-DIAGNOSTIC-001");
  assert.ok(product, "Commander Deck Diagnostic listing missing");
  assert.equal(product.category, "mtg");
  assert.equal(product.sku, "CMD-DIAG-29");
  assert.equal(product.price, 29);
  assert.equal(product.currency, "nzd");
  assert.equal(product.checkout_available, true);
  assert.equal(product.checkout_url, "https://buy.stripe.com/eVqeVdc1T01n1DV3gwdwc30");
});

test("claim-by-message MTG listings are not represented as online checkout", () => {
  for (const id of ["EDH_QUINTORIUS_0002", "EDH_DWYNEN_0003"]) {
    const product = byId(id);
    assert.ok(product, `${id} listing missing`);
    assert.equal(product.checkout_available, false);
    assert.equal(product.checkout_url, null);
    assert.equal(product.sale_mode, "claim_by_message");
  }
});
