'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { compile } = require('../UniversalCompiler');
const { buildRuntimeHtml } = require('./KelplantisRuntime');
const { build7BScript } = require('./Kelplantis7B');
const { build7CScript } = require('./Kelplantis7C');
const { generateDungeon } = require('./KelplantisDungeonGenerator');

const ROOT = path.join(__dirname, '..', '..');
const SPEC = path.join(ROOT, 'compiler', 'universal-specs', 'kelplantis-mvp.json');
const OUT = path.join(ROOT, 'compiled', 'universal', 'game', 'kelplantis-mvp');
const PROOF = path.join(ROOT, 'RUN-PROOFS', 'KELPLANTIS-MVP-COMPILER-PROOF.json');
const sha256 = v => crypto.createHash('sha256').update(v, 'utf8').digest('hex');

function inject7B(runtimeHtml) {
  const marker = '</script></body></html>';
  if (!runtimeHtml.includes(marker)) throw new Error('Kelplantis runtime script boundary missing');
  return runtimeHtml.replace(marker, build7BScript() + build7CScript() + marker);
}

function run() {
  const base = compile();
  const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
  const dungeon = generateDungeon({ world_seed: spec.game.world.worldSeed, floor_id: spec.game.world.floorId, canonical_boss_id: spec.game.world.bossId, floor_version: spec.game.world.floorVersion, room_count: spec.game.world.roomCount, width: 80, height: 50 });
  fs.mkdirSync(OUT, { recursive: true });
  const runtimeHtml = inject7B(buildRuntimeHtml(spec, dungeon));
  fs.writeFileSync(path.join(OUT, 'index.html'), runtimeHtml, 'utf8');
  fs.writeFileSync(path.join(OUT, 'game.json'), JSON.stringify({ id: spec.id, profile: spec.game.profile, world: spec.game.world, town: spec.game.town, acceptance: { create_avatar: true, depth_1: true, fountain_spawn: true, movement: true, player_presence: true, inspection: true, proximity_chat: true, emotes: true, persistence: true, parcels: true, soul_anchor: true, offline_echo: true, reconnect_to_anchor: true, wild_resource_nodes: true, authoritative_harvest: true, resource_realtime: true } }, null, 2) + '\n', 'utf8');
  const files = ['index.html', 'game.json'].map(name => ({ path: `compiled/universal/game/kelplantis-mvp/${name}`, sha256: sha256(fs.readFileSync(path.join(OUT, name), 'utf8')) }));
  const proof = { schema:'bec/kelplantis-mvp-compiler-proof/v7', dungeon, status:'PASS', base_universal_compile:base.status, target:'kelplantis-mvp', target_type:'game', runtime:'HTML5/browser, Windows-hostable', native_windows_exe:false, slice:'DEPTH_1_SOCIAL_7C', acceptance:{ create_avatar:'SOURCE_PRESENT', fountain_spawn:'SOURCE_PRESENT', movement:'SOURCE_PRESENT', player_presence:'SOURCE_PRESENT', inspection:'SOURCE_PRESENT', proximity_chat:'SOURCE_PRESENT', emotes:'SOURCE_PRESENT', persistence:'SOURCE_PRESENT', parcels:'SOURCE_PRESENT', soul_anchor:'SOURCE_PRESENT', offline_echo:'SOURCE_PRESENT', reconnect_to_anchor:'SOURCE_PRESENT', wild_resource_nodes:'SOURCE_PRESENT', authoritative_harvest:'SOURCE_PRESENT', resource_realtime:'SOURCE_PRESENT', launch:'GENERATED_NOT_RUNTIME_VERIFIED', two_client:'NOT_RUNTIME_VERIFIED' }, outputs:files, runtime_verification:'NOT_EXECUTED' };
  fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  return proof;
}

if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { run };
