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
