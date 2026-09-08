const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const URL = process.env.KELPLANTIS_SUPABASE_URL;
const KEY = process.env.KELPLANTIS_SUPABASE_ANON_KEY;
const BASE = process.env.KELPLANTIS_BASE_URL || 'http://127.0.0.1:4173/';
const OUT = path.resolve('compiled/universal/game/kelplantis-mvp');

function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])]));
  return v;
}
function digest(v) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(v)), 'utf8').digest('hex');
}
function safePlayer(p) {
  if (!p) return p;
  const x = { ...p };
  delete x.player_token;
  delete x.created_at;
  delete x.updated_at;
  return x;
}
async function rpc(page, name, args) {
  return page.evaluate(async ({ url, key, name, args }) => {
    const r = await fetch(url.replace(/\/$/, '') + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {})
    });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch (_) { data = text; }
    return { ok: r.ok, status: r.status, data };
  }, { url: URL, key: KEY, name, args });
}
async function mustRpc(page, name, args) {
  const r = await rpc(page, name, args);
  if (!r.ok) throw new Error(name + ' failed: ' + JSON.stringify(r.data));
  return r.data;
}
async function player(page, token) { return safePlayer(await mustRpc(page, 'kelplantis_get_player', { p_token: token })); }
async function world(page) { return mustRpc(page, 'kelplantis_get_world_state', { p_world_key: 'floor1' }); }
async function gate(page, token) { return mustRpc(page, 'kelplantis_get_floor_gate', { p_token: token, p_floor_id: 2 }); }

test('live authoritative Kelplantis Floor 1', async ({ page }) => {
  test.setTimeout(180000);
  if (!URL || !KEY) throw new Error('live Supabase secrets are missing');
  if (/service_role/i.test(KEY)) throw new Error('service role key forbidden in browser');

  const errors = [];
  const transitions = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));

  const transition = (name, before, action, after) => {
    const evidence = { name, before: stable(before), action: stable(action), after: stable(after) };
    transitions.push({ name, evidence_sha256: digest(evidence), evidence });
  };

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#authority')).toHaveText('AUTHORITY: SUPABASE');

  const created = await mustRpc(page, 'kelplantis_create_player', {
    p_name: 'CI-LIVE-' + Date.now(),
    p_color_hue: 180
  });
  expect(created.player_token).toBeTruthy();
  const token = created.player_token;
  await page.evaluate(v => sessionStorage.setItem('kelplantis_player_token', v), token);
  await page.reload({ waitUntil: 'domcontentloaded' });

  let p = await player(page, token);
  transition('player_created', null, { rpc: 'kelplantis_create_player' }, p);

  let before = p;
  p = safePlayer(await mustRpc(page, 'kelplantis_enter_floor', { p_token: token, p_floor_id: 1 }));
  transition('floor_1_entered', before, { rpc: 'kelplantis_enter_floor', p_floor_id: 1 }, p);
  expect(p.scene).toBe('TOWN');

  before = p;
  await page.click('#dungeon');
  await expect(page.locator('#scene')).toHaveText('DUNGEON');
  p = await player(page, token);
  transition('movement_authoritative', before, { ui: 'Enter Dungeon', rpc: 'kelplantis_move_player' }, p);
  expect(p.scene).toBe('DUNGEON');

  before = p;
  await page.click('#engage');
  await page.waitForTimeout(100);
  p = await player(page, token);
  transition('encounter_authoritative', before, { ui: 'Engage', rpc: 'kelplantis_engage_encounter' }, p);
  expect(p.current_encounter).not.toBeNull();

  let attacks = 0;
  while (!(p.floor_progress && p.floor_progress['1'] && p.floor_progress['1'].bossDefeated) && attacks < 100) {
    if (!p.current_encounter) {
      before = p;
      await page.click('#engage');
      await page.waitForTimeout(100);
      p = await player(page, token);
      transition('next_encounter_' + attacks, before, { ui: 'Engage', rpc: 'kelplantis_engage_encounter' }, p);
      continue;
    }
    before = p;
    await page.click('#attack');
    await page.waitForTimeout(100);
    p = await player(page, token);
    transition('combat_' + attacks, before, { ui: 'Attack', rpc: 'kelplantis_attack' }, p);
    attacks++;
  }

  expect(attacks).toBeGreaterThan(0);
  expect(p.floor_progress['1'].bossDefeated).toBe(true);
  expect(p.scene).toBe('TOWN');

  const w = await world(page);
  const g = await gate(page, token);
  transition('boss_world_gate', null, {
    rpc_chain: ['kelplantis_attack', 'kelplantis_record_floor1_boss_clear', 'kelplantis_apply_floor1_first_clear']
  }, { player: p, world: w, gate: g });
  expect(w.state.garden_state).toBe('changed_after_first_clear');
  expect(g.unlocked).toBe(true);

  await page.reload({ waitUntil: 'domcontentloaded' });
  const pReload = await player(page, token);
  const wReload = await world(page);
  const gReload = await gate(page, token);
  transition('reload_persistence', { player: p, world: w, gate: g }, { action: 'browser reload' }, { player: pReload, world: wReload, gate: gReload });
  expect(pReload.floor_progress['1'].bossDefeated).toBe(true);
  expect(wReload.state.garden_state).toBe('changed_after_first_clear');
  expect(gReload.unlocked).toBe(true);

  const forged = await mustRpc(page, 'kelplantis_create_player', {
    p_name: 'CI-FORGE-' + Date.now(),
    p_color_hue: 0
  });
  const deny = async (name, args) => {
    const r = await rpc(page, name, args);
    expect(r.ok, name + ' unexpectedly succeeded').toBe(false);
    return r;
  };
  const fakeBoss = await deny('kelplantis_record_floor1_boss_clear', { p_player_id: forged.id });
  const fakeFloor = await deny('kelplantis_enter_floor', { p_token: forged.player_token, p_floor_id: 2 });
  const fakeWorld = await deny('kelplantis_apply_floor1_first_clear', { p_token: forged.player_token });

  const proof = {
    schema: 'bec/kelplantis/live-browser-e2e-proof/v3',
    status: 'PASS',
    player_created: true,
    floor_1_entered: true,
    movement_authoritative: true,
    encounter_authoritative: true,
    combat_authoritative: attacks > 0,
    boss_clear_authoritative: p.floor_progress['1'].bossDefeated === true,
    world_consequence_observed: w.state.garden_state === 'changed_after_first_clear',
    floor_2_unlocked: g.unlocked === true,
    state_survived_reload: pReload.floor_progress['1'].bossDefeated === true && gReload.unlocked === true && wReload.state.garden_state === 'changed_after_first_clear',
    illegal_floor_2_entry_rejected: fakeFloor.ok === false,
    illegal_boss_clear_rejected: fakeBoss.ok === false,
    illegal_world_mutation_rejected: fakeWorld.ok === false,
    synthetic_events_counted_as_player_evidence: false,
    player_id: created.id,
    boss_clear: p.floor_progress['1'],
    world_state: w,
    after_gate: g,
    floor_progress: p.floor_progress,
    transitions,
    console_errors: errors
  };
  proof.evidence_sha256 = digest(proof);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'kelplantis-live-browser-e2e-proof.json'), JSON.stringify(proof, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, 'kelplantis-live-browser-e2e-proof.sha256'), proof.evidence_sha256 + '\n');

  expect(errors).toEqual([]);
});
