const { test, expect } = require('@playwright/test');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const DIST = path.resolve(__dirname, '..', 'compiler', 'kelplantis', 'dist');
const PROOF = path.join(DIST, 'kelplantis-live-browser-e2e-proof.json');
const PROOF_HASH = path.join(DIST, 'kelplantis-live-browser-e2e-proof.sha256');
const BASE_URL = 'http://127.0.0.1:4173';

function rpcUrl(name) { return `${process.env.KELPLANTIS_SUPABASE_URL}/rest/v1/rpc/${name}`; }
async function rpc(name, body) {
  const response = await fetch(rpcUrl(name), {
    method: 'POST',
    headers: {
      apikey: process.env.KELPLANTIS_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${process.env.KELPLANTIS_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  let data = null;
  try { data = await response.json(); } catch (_) {}
  return { status: response.status, data };
}
function writeProof(proof) {
  fs.mkdirSync(DIST, { recursive: true });
  delete proof.evidence_sha256;
  const unsigned = JSON.stringify(proof, null, 2) + '\n';
  const hash = crypto.createHash('sha256').update(unsigned, 'utf8').digest('hex');
  proof.evidence_sha256 = hash;
  fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n');
  fs.writeFileSync(PROOF_HASH, hash + '  kelplantis-live-browser-e2e-proof.json\n');
}
async function getPlayer(token, label) {
  const result = await rpc('kelplantis_get_player', { p_token: token });
  if (result.status !== 200 || !result.data) throw new Error(`${label}: get_player failed with ${result.status}`);
  return result.data;
}
function worldKeyResult(result, label) {
  if (result.status !== 200 || !result.data) throw new Error(`${label}: world-state RPC failed with ${result.status}`);
  return result.data;
}

test('Kelplantis Floor 1 live browser authoritative journey', async ({ page }) => {
  const token = process.env.KELPLANTIS_PLAYER_TOKEN;
  const playerId = process.env.KELPLANTIS_PLAYER_ID;
  if (!token || !playerId) throw new Error('isolated player credentials were not supplied');

  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(String(err)));

  const proof = {
    schema: 'bec/kelplantis/live-browser-e2e-proof/v2', status: 'FAIL', player_created: true,
    floor_1_entered: false, movement_authoritative: false, encounter_authoritative: false,
    combat_authoritative: false, boss_clear_authoritative: false, world_consequence_observed: false,
    floor_2_unlocked: false, state_survived_reload: false, illegal_floor_2_entry_rejected: false,
    synthetic_events_counted_as_player_evidence: false, player_id: playerId,
    player_token_sha256: crypto.createHash('sha256').update(token).digest('hex'),
    source_commit: process.env.GITHUB_SHA || 'local', console_errors: [], failure: null
  };

  try {
    const beforePlayer = await getPlayer(token, 'before');
    const beforeProgressResult = await rpc('kelplantis_get_floor_progress', { p_token: token });
    const beforeGateResult = await rpc('kelplantis_get_floor_gate', { p_token: token, p_floor_id: 2 });
    if (beforePlayer.id !== playerId) throw new Error('fresh player lookup returned wrong player');
    if (beforePlayer.scene !== 'TOWN') throw new Error('fresh player did not start in TOWN');
    if (beforeGateResult.status !== 200 || !beforeGateResult.data || beforeGateResult.data.unlocked !== false) throw new Error('Floor 2 unexpectedly unlocked before play');
    proof.before_player = beforePlayer;
    proof.before_progress = beforeProgressResult.data;
    proof.before_gate = beforeGateResult.data;

    const illegal = await rpc('kelplantis_enter_floor', { p_token: token, p_floor_id: 2 });
    if (illegal.status === 200) throw new Error('illegal Floor 2 entry was accepted');
    proof.illegal_floor_2_status = illegal.status;
    proof.illegal_floor_2_entry_rejected = true;

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.evaluate(({ url, key, playerToken }) => {
      window.__KELPLANTIS_CONFIG__ = { supabaseUrl: url, supabaseAnonKey: key };
      sessionStorage.setItem('kelplantis_player_token', playerToken);
    }, { url: process.env.KELPLANTIS_SUPABASE_URL, key: process.env.KELPLANTIS_SUPABASE_ANON_KEY, playerToken: token });
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('h1')).toContainText('Kelplantis');
    await expect(page.getByText('AUTHORITY: SUPABASE')).toBeVisible();

    const townX = Number(beforePlayer.pos_x);
    const townY = Number(beforePlayer.pos_y);
    await page.getByRole('button', { name: /Enter Dungeon/i }).click();
    await page.waitForTimeout(300);
    let player = await getPlayer(token, 'after-enter');
    if (player.scene !== 'DUNGEON') throw new Error('authoritative Floor 1 movement not observed');
    proof.floor_1_entered = beforePlayer.scene === 'TOWN' && player.scene === 'DUNGEON';
    proof.movement_authoritative = Number.isInteger(player.pos_x) && Number.isInteger(player.pos_y) && player.scene === 'DUNGEON' && (player.pos_x !== townX || player.pos_y !== townY);
    proof.authoritative_dungeon_player = player;
    if (!proof.movement_authoritative) throw new Error('server did not return changed authoritative movement state');

    let sawNormalDefeat = false;
    for (let step = 0; step < 24; step++) {
      if (!player.current_encounter) {
        const engage = await rpc('kelplantis_engage_encounter', { p_token: token });
        if (engage.status !== 200 || !engage.data || !engage.data.current_encounter) throw new Error(`encounter RPC failed at step ${step}`);
        player = engage.data;
        proof.encounter_authoritative = true;
      }

      const beforeHp = Number(player.current_encounter.enemy_hp ?? player.current_encounter.enemyHp);
      const beforeEncounter = JSON.stringify(player.current_encounter);
      const attack = await rpc('kelplantis_attack', { p_token: token });
      if (attack.status !== 200 || !attack.data) throw new Error(`attack RPC failed at step ${step}`);
      player = attack.data;
      proof.combat_authoritative = true;
      const afterHp = player.current_encounter ? Number(player.current_encounter.enemy_hp ?? player.current_encounter.enemyHp) : 0;
      if (player.current_encounter && afterHp >= beforeHp) throw new Error('authoritative attack did not reduce enemy HP');
      if (!player.current_encounter && beforeHp > 0) sawNormalDefeat = true;
      proof.last_attack_before_encounter = beforeEncounter;
      proof.last_attack_after_player = player;

      if (player.scene === 'TOWN' && player.floor_progress && player.floor_progress['1'] && player.floor_progress['1'].bossDefeated === true) {
        proof.boss_clear_authoritative = true;
        break;
      }
      if (player.scene !== 'DUNGEON') throw new Error('unexpected scene during authoritative combat');
    }
    proof.normal_encounter_defeat_observed = sawNormalDefeat;
    if (!proof.boss_clear_authoritative) throw new Error('boss was not cleared authoritatively within attack budget');

    const afterPlayer = await getPlayer(token, 'after-clear');
    const afterProgressResult = await rpc('kelplantis_get_floor_progress', { p_token: token });
    const afterGateResult = await rpc('kelplantis_get_floor_gate', { p_token: token, p_floor_id: 2 });
    const worldResult = await rpc('kelplantis_get_world_state', { p_world_key: 'floor1' });
    const world = worldKeyResult(worldResult, 'after-clear');
    if (afterProgressResult.status !== 200 || afterGateResult.status !== 200) throw new Error('post-clear authority probes failed');
    const afterProgress = afterProgressResult.data;
    const afterGate = afterGateResult.data;
    proof.after_player = afterPlayer;
    proof.floor_progress = afterProgress;
    proof.after_gate = afterGate;
    proof.world = world;
    proof.world_consequence_observed = !!world && (world.state === 'changed_after_first_clear' || world.world_state === 'changed_after_first_clear');
    proof.floor_2_unlocked = !!afterGate && afterGate.unlocked === true && Number(afterProgress.highest_unlocked_floor) >= 2;
    if (!proof.world_consequence_observed) throw new Error('world consequence not observed');
    if (!proof.floor_2_unlocked) throw new Error('Floor 2 was not authoritatively unlocked');

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText('AUTHORITY: SUPABASE')).toBeVisible();
    const persistedPlayer = await getPlayer(token, 'persisted');
    const persistedProgressResult = await rpc('kelplantis_get_floor_progress', { p_token: token });
    const persistedGateResult = await rpc('kelplantis_get_floor_gate', { p_token: token, p_floor_id: 2 });
    const persistedWorldResult = await rpc('kelplantis_get_world_state', { p_world_key: 'floor1' });
    const persistedWorld = worldKeyResult(persistedWorldResult, 'persisted');
    if (persistedProgressResult.status !== 200 || persistedGateResult.status !== 200) throw new Error('reload authority probes failed');
    const persistedProgress = persistedProgressResult.data;
    const persistedGate = persistedGateResult.data;
    proof.persisted_player = persistedPlayer;
    proof.persisted_progress = persistedProgress;
    proof.persisted_gate = persistedGate;
    proof.persisted_world = persistedWorld;
    proof.state_survived_reload = Number(persistedProgress.highest_unlocked_floor) >= 2 && persistedGate.unlocked === true && !!persistedWorld && (persistedWorld.state === 'changed_after_first_clear' || persistedWorld.world_state === 'changed_after_first_clear');
    if (!proof.state_survived_reload) throw new Error('authoritative state did not survive browser reload');
    if (consoleErrors.length) throw new Error(`browser console errors: ${consoleErrors.join(' | ')}`);

    proof.status = 'PASS';
  } catch (error) {
    proof.failure = String(error && error.stack ? error.stack : error);
    throw error;
  } finally {
    proof.console_errors = consoleErrors;
    writeProof(proof);
  }
});
