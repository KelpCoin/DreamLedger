import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(p, "utf8");
const avatar = read("public/avatar.html");
const billboard = read("public/billboard.html");
const identity = read("public/assets/avatar-identity.js");
const catalogue = JSON.parse(read("public/catalog.json"));
const checks = [];
function check(name, fn) {
  try {
    fn();
    checks.push({ name, status: "PASS" });
    console.log("PASS " + name);
  } catch (error) {
    checks.push({ name, status: "FAIL", error: String(error && error.message || error) });
    console.error("FAIL " + name + ": " + String(error && error.message || error));
  }
}

check("avatar_has_try_on_but_no_client_purchase_or_demo_unlock", () => {
  assert.match(avatar, /Live try-on/);
  assert.match(avatar, /paid unlocks.*held|checkout.*held/i);
  assert.doesNotMatch(avatar, /Unlock demo/i);
  assert.doesNotMatch(avatar, /DreamLedgerAvatar\.own\s*\(/);
  assert.doesNotMatch(avatar, /\/buy\/DREAMMEEZ-SUPPORTER-SPROUT/i);
  assert.match(avatar, /Consumer Guarantees Act 1993/);
});

check("local_storage_cannot_create_or_equip_paid_entitlements", () => {
  const storage = new Map();
  storage.set("dreamledger_avatar_identity_v1", JSON.stringify({
    schema: "dreamledger-avatar-identity-v1",
    display_name: "forged",
    height: 5, build: 4, shape: 1, skin: 3, style: "medium", hair: 0,
    owned: ["founder-cloak", "chrome-boots"],
    equipped: { face: "dragon-mark", neck: null, body: null, hair: null, feet: "chrome-boots", back: "founder-cloak" },
    updated_at: null
  }));
  const windowMock = {
    localStorage: {
      getItem: (k) => storage.has(k) ? storage.get(k) : null,
      setItem: (k, v) => storage.set(k, v)
    },
    dispatchEvent: () => true
  };
  const context = { window: windowMock, globalThis: windowMock, CustomEvent: function () {} };
  vm.runInNewContext(identity, context, { timeout: 1000 });
  const api = windowMock.DreamLedgerAvatar;
  assert.ok(api, "avatar identity module loaded");
  assert.deepEqual(Array.from(api.load().owned), []);
  assert.equal(api.load().equipped.back, null);
  assert.deepEqual(Array.from(api.own("founder-cloak").owned), []);
  const saved = api.save({ ...api.load(), owned: ["founder-cloak"], equipped: { back: "founder-cloak" } });
  assert.deepEqual(Array.from(saved.owned), []);
  assert.equal(saved.equipped.back, null);
  assert.equal(api.equip("founder-cloak").equipped.back, null);
  assert.equal(api.exportForSurface("phinhaven").equipped.length, 0);
  assert.equal(api.exportForSurface("phinhaven").buffs.length, 0);
});

check("billboard_checkout_matches_canonical_catalogue_hold", () => {
  const product = catalogue.products.find((p) => p.id === "DREAMLEDGER-BILLBOARD-FOUNDING-001");
  assert.ok(product, "canonical Billboard product exists");
  assert.equal(product.checkout_available, false);
  assert.equal(product.checkout_url, null);
  assert.doesNotMatch(billboard, /href\s*=\s*["']https:\/\/buy\.stripe\.com/i);
  assert.match(billboard, /checkout temporarily held/i);
  assert.match(billboard, /No purchase is accepted from this page/i);
  assert.match(billboard, /settlement and fulfilment are verified/i);
});

check("public_claims_preserve_truth_and_no_false_urgency", () => {
  assert.doesNotMatch(billboard, /Stripe checkout live/i);
  assert.doesNotMatch(billboard, /launch ends today|ends today/i);
  assert.doesNotMatch(avatar, /instant entitlement/i);
});

const report = {
  schema: "dreamledger.surface-integrity-proof/v1",
  gate: "DREAMMEEZ_AVATAR_AND_BILLBOARD",
  status: checks.every((x) => x.status === "PASS") ? "PASS" : "FAIL",
  live_production_checked: false,
  checkout_executed: false,
  production_deployed: false,
  verified_external_revenue_nzd: "0.00",
  checks,
  timestamp: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || "local"
};
fs.mkdirSync("proof-artifacts", { recursive: true });
fs.writeFileSync("proof-artifacts/DREAMMEEZ_BILLBOARD_INTEGRITY.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.status !== "PASS") process.exitCode = 1;
