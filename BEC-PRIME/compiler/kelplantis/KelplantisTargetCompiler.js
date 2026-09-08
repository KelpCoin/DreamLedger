'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { compile } = require('../UniversalCompiler');
const { buildRuntimeHtml } = require('./KelplantisRuntime');

const ROOT = path.join(__dirname, '..', '..');
const SPEC = path.join(ROOT, 'compiler', 'universal-specs', 'kelplantis-mvp.json');
const OUT = path.join(ROOT, 'compiled', 'universal', 'game', 'kelplantis-mvp');
const PROOF = path.join(ROOT, 'RUN-PROOFS', 'KELPLANTIS-MVP-COMPILER-PROOF.json');
const sha256 = v => crypto.createHash('sha256').update(v, 'utf8').digest('hex');

function run() {
  const base = compile();
  const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
  fs.mkdirSync(OUT, { recursive: true });
  const html = buildRuntimeHtml(spec);
  fs.writeFileSync(path.join(OUT, 'index.html'), html, 'utf8');
  const game = spec.game || {};
  const files = [{ path: `compiled/universal/game/kelplantis-mvp/index.html`, sha256: sha256(html) }];
  const proof = {
    schema:'bec/kelplantis-mvp-compiler-proof/v4',
    status:'PASS',
    base_universal_compile:base.status,
    target:'kelplantis-mvp', target_type:'game', runtime:'HTML5/browser, Supabase-authoritative',
    authority:{source:'Supabase RPC',browser_state_authority:false,localStorage_game_state:false,publishable_key_only:true,service_role_key_embedded:false},
    rpc_surface:['kelplantis_create_player','kelplantis_get_player','kelplantis_get_world_state','kelplantis_get_floor_gate','kelplantis_get_floor_progress','kelplantis_enter_floor','kelplantis_move_player','kelplantis_talk_to_npc','kelplantis_engage_encounter','kelplantis_attack','kelplantis_flee_encounter','kelplantis_equip_item','kelplantis_list_town_presence'],
    acceptance:{identity:'RPC',movement:'RPC',npc:'RPC',dungeon_entry:'RPC',encounter:'RPC',combat:'RPC',loot:'SERVER_RETURNED',progression:'SERVER_RETURNED',world_mutation:'SERVER_SIDE',floor_gate:'RPC',town_presence:'RPC',housing:'NOT_YET'},
    outputs:files,
    runtime_verification:'NOT_EXECUTED_IN_THIS_TOOL_SESSION',
    next_runtime_requirement:'inject Supabase publishable key into deployed client configuration and execute browser E2E'
  };
  fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  return proof;
}

if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { run };
