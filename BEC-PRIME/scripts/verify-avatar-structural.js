'use strict';

/*
 * Structural verifier for the canonical DreamMeez identity chain.
 *
 * This verifier intentionally uses the Supabase service role only for
 * structural inspection. It does NOT test authorization or RLS behavior.
 * Authorization is tested by a separate application-level verifier.
 *
 * Required environment:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const assert = require('assert');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Structural verification requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

async function select(table, columns) {
  const url = SUPABASE_URL + '/rest/v1/' + encodeURIComponent(table) + '?select=' + encodeURIComponent(columns);
  const response = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + SERVICE_ROLE_KEY,
      Accept: 'application/json'
    }
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error('Supabase structural read failed for ' + table + ': HTTP ' + response.status);
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error('Supabase structural read returned invalid JSON for ' + table + '.');
  }
}

function duplicateValues(rows, keyFn) {
  const seen = new Set();
  const duplicates = [];
  for (const row of rows) {
    const value = keyFn(row);
    if (value == null) continue;
    if (seen.has(String(value))) duplicates.push(String(value));
    seen.add(String(value));
  }
  return duplicates;
}

(async () => {
  const [accounts, avatars, items, players, commerce] = await Promise.all([
    select('dreamledger_accounts', 'id'),
    select('dreammeez_avatars', 'account_id,avatar_id,version,appearance,equipped,progression'),
    select('dreammeez_avatar_items', 'account_id,item_id'),
    select('kelplantis_players', 'id,account_id,avatar_id'),
    select('commerce_items', 'item_id')
  ]);

  const accountIds = new Set(accounts.map(row => String(row.id)));
  const avatarById = new Map(avatars.map(row => [String(row.avatar_id), row]));
  const itemIds = new Set(commerce.map(row => String(row.item_id)));

  assert.strictEqual(duplicateValues(avatars, row => row.account_id).length, 0,
    'canonical avatar table must contain at most one avatar per account');
  assert.strictEqual(duplicateValues(avatars, row => row.avatar_id).length, 0,
    'canonical avatar ids must be unique');
  assert.strictEqual(duplicateValues(items, row => String(row.account_id) + '\\0' + String(row.item_id)).length, 0,
    'canonical item ownership contains duplicate account/item pairs');

  const orphanAvatars = avatars.filter(row => !accountIds.has(String(row.account_id)));
  const orphanItems = items.filter(row =>
    !accountIds.has(String(row.account_id)) || !itemIds.has(String(row.item_id))
  );
  const invalidVersions = avatars.filter(row => !Number.isInteger(Number(row.version)) || Number(row.version) < 1);
  const invalidJson = avatars.filter(row =>
    !row.appearance || typeof row.appearance !== 'object' || Array.isArray(row.appearance) ||
    !row.equipped || typeof row.equipped !== 'object' || Array.isArray(row.equipped) ||
    !row.progression || typeof row.progression !== 'object' || Array.isArray(row.progression)
  );

  const invalidPlayerBindings = players.filter(row => {
    const hasAccount = row.account_id != null;
    const hasAvatar = row.avatar_id != null;
    if (!hasAccount && !hasAvatar) return false;
    if (hasAccount !== hasAvatar) return true;
    const avatar = avatarById.get(String(row.avatar_id));
    return !avatar || String(avatar.account_id) !== String(row.account_id);
  });

  assert.strictEqual(orphanAvatars.length, 0, 'canonical avatars contain orphaned account references');
  assert.strictEqual(orphanItems.length, 0, 'canonical item ownership contains orphaned account/item references');
  assert.strictEqual(invalidVersions.length, 0, 'canonical avatar version invariant failed');
  assert.strictEqual(invalidJson.length, 0, 'canonical avatar JSON object invariant failed');
  assert.strictEqual(invalidPlayerBindings.length, 0, 'Kelplantis contains an invalid account/avatar binding');

  console.log(JSON.stringify({
    verdict: 'AVATAR_STRUCTURAL_PASS',
    authorization_boundary: 'APPLICATION_LAYER_OPTION_C',
    counts: {
      accounts: accounts.length,
      avatars: avatars.length,
      avatar_items: items.length,
      kelplantis_players: players.length,
      commerce_items: commerce.length
    },
    checks: [
      'one_avatar_per_account',
      'canonical_avatar_id_uniqueness',
      'canonical_item_ownership_pair_uniqueness',
      'account_references',
      'item_references',
      'avatar_version_invariant',
      'avatar_json_object_invariants',
      'kelplantis_account_avatar_consistency'
    ]
  }, null, 2));
})().catch(error => {
  console.error('AVATAR_STRUCTURAL_FAIL: ' + error.message);
  process.exitCode = 1;
});
