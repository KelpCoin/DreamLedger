import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyInboxClaim,
  firstNonEmptyString,
  resolveStripeSku
} from "./stripe-webhook-contract.mjs";

test("client_reference_id has resolver precedence", () => {
  assert.equal(resolveStripeSku({
    client_reference_id: " QUOTE-COMPARE-49 ",
    metadata: { sku_id: "OTHER-SKU", sku: "OLDER-SKU" },
    payment_intent_data: { metadata: { sku_id: "PI-SKU" } }
  }), "QUOTE-COMPARE-49");
});

test("resolver supports metadata fallbacks in contract order", () => {
  assert.equal(resolveStripeSku({ metadata: { sku_id: "SKU-ID", sku: "SKU" } }), "SKU-ID");
  assert.equal(resolveStripeSku({ metadata: { sku: "SKU" } }), "SKU");
  assert.equal(resolveStripeSku({ payment_intent_data: { metadata: { sku_id: "PI-SKU" } } }), "PI-SKU");
  assert.equal(resolveStripeSku({ marketplace_listing_id: "LISTING-1" }), "LISTING-1");
});

test("resolver rejects empty values and never invents a SKU", () => {
  assert.equal(resolveStripeSku({
    client_reference_id: " ",
    metadata: { sku_id: null, sku: "" },
    payment_intent_data: { metadata: { sku_id: 123 } }
  }), "");
  assert.equal(firstNonEmptyString([null, 42, "", "  ", "SKU"]), "SKU");
});

test("inbox duplicate and in-progress outcomes remain distinct", () => {
  assert.equal(classifyInboxClaim("CLAIMED"), "PROCESS");
  assert.equal(classifyInboxClaim("DONE"), "DUPLICATE");
  assert.equal(classifyInboxClaim("BUSY"), "BUSY");
  assert.equal(classifyInboxClaim("FAILED"), "BUSY");
});
