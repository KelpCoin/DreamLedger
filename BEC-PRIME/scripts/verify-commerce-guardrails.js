'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const migrationPath = path.join(root, 'supabase', 'migrations', '20261019_harden_dreammeez_item_ownership.sql');
const ownershipTestPath = path.join(root, 'supabase', 'tests', 'dreammeez_ownership_security.sql');
const deckFunctionPath = path.join(root, 'supabase', 'functions', 'mtg-deck-catalog', 'index.ts');

for (const file of [migrationPath, ownershipTestPath, deckFunctionPath]) {
  assert.ok(fs.existsSync(file), 'Required guardrail file missing: ' + path.relative(root, file));
}

const migration = fs.readFileSync(migrationPath, 'utf8');
const sqlTest = fs.readFileSync(ownershipTestPath, 'utf8');
const deckFunction = fs.readFileSync(deckFunctionPath, 'utf8');
const mtgMigrationPath = path.join(root, 'supabase', 'migrations', '20261019_harden_mtg_marketplace_state.sql');
const mtgSyncPath = path.join(root, 'supabase', 'functions', 'mtg-catalog-sync', 'index.ts');
const mtgMigration = fs.readFileSync(mtgMigrationPath, 'utf8');
const mtgSync = fs.readFileSync(mtgSyncPath, 'utf8');

assert.match(migration, /enable row level security/i, 'Ownership RLS must be enabled');
assert.match(migration, /drop policy if exists/i, 'Migration must remove existing mutation policies');
assert.match(migration, /revoke insert, update, delete/i, 'Browser write privileges must be revoked');
assert.doesNotMatch(migration, /create policy[^;]+for\s+(insert|update|delete)/i, 'Migration must not create client mutation policies');

assert.match(sqlTest, /has_table_privilege\('authenticated',\s*'public\.commerce_item_ownership',\s*'INSERT'\)/i,
  'Database verification must check direct authenticated insert privilege');
assert.match(sqlTest, /pg_policies/i, 'Database verification must inspect effective RLS policies');

assert.match(deckFunction, /const publish = false;/,
  'Deck submissions must fail closed to draft until a separate authorized moderation path exists');
assert.match(deckFunction, /HELD_FOR_HUMAN_REVIEW/,
  'Deck API must disclose that public publication is held for human review');
assert.match(mtgMigration, /mtg_purchase_intents/, 'MTG purchase-intent state must be server-controlled');
assert.match(mtgMigration, /mtg_bids/, 'MTG bid state must be server-controlled');
assert.match(mtgMigration, /alter table public\.mtg_cards alter column status set default 'draft'/i,
  'New MTG listings must default to draft');
assert.match(mtgSync, /MTG_CATALOG_SYNC_ADMIN_USER_IDS/,
  'MTG catalog sync must check an explicit administrator allowlist');
assert.match(mtgSync, /adminIds\.has\(user\.id\)/,
  'MTG catalog sync must bind authorization to a verified user');
assert.match(mtgSync, /toNzd\(usd, fxRate\)/,
  'USD prices must be converted before writing NZD values');
assert.doesNotMatch(mtgSync, /const nzd = prices\.usd_foil \? Number\(prices\.usd_foil\) : usd/,
  'USD values must not be copied directly into NZD field');

console.log('PASS: static commerce guardrails verified. Database SQL test is separate and must be run against an accessible non-production database.');
