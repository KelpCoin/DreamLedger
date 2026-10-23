import assert from "node:assert/strict";
import test from "node:test";
import { firstNonBlank } from "./nonblank-env.mjs";

test("trims candidates and falls back past whitespace-only values", () => {
  assert.equal(firstNonBlank("   ", " test-fallback ", "later"), "test-fallback");
});

test("prefers the first nonblank candidate", () => {
  assert.equal(firstNonBlank(" test-primary ", "test-fallback"), "test-primary");
});

test("returns null when every candidate is missing or blank", () => {
  assert.equal(firstNonBlank(undefined, null, "", "  "), null);
});

test("ignores non-string candidates", () => {
  assert.equal(firstNonBlank(42, false, " usable "), "usable");
});
