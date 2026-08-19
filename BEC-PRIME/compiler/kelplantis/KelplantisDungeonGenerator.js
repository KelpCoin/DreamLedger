'use strict';

const crypto = require('crypto');

function hashSeed(worldSeed, floorId, bossId, version) {
  return crypto.createHash('sha256').update(`${worldSeed}:${floorId}:${bossId}:${version}`, 'utf8').digest('hex');
}

function rngFromHex(hex) {
  let state = Number.parseInt(hex.slice(0, 8), 16) >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function generateDungeon(input) {
  const floorId = Number(input.floor_id);
  const version = String(input.floor_version || '1');
  const bossId = String(input.canonical_boss_id || `kelp_floor${floorId}_boss`);
  const worldSeed = String(input.world_seed || 'kelplantis');
  const width = Number(input.width || 80);
  const height = Number(input.height || 50);
  const seed = hashSeed(worldSeed, floorId, bossId, version);
  const rand = rngFromHex(seed);
  const rooms = [];
  const count = Math.max(8, Math.min(30, Number(input.room_count || 14)));

  for (let i = 0; i < count; i += 1) {
    const w = 6 + Math.floor(rand() * 8);
    const h = 5 + Math.floor(rand() * 7);
    const x = 2 + Math.floor(rand() * Math.max(1, width - w - 4));
    const y = 2 + Math.floor(rand() * Math.max(1, height - h - 4));
    rooms.push({ id: i, x, y, w, h, tag: 'combat' });
  }

  const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const distance = (a, b) => Math.hypot(center(a).x - center(b).x, center(a).y - center(b).y);
  const edges = [];
  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) edges.push({ a: i, b: j, d: distance(rooms[i], rooms[j]) });
  }
  edges.sort((a, b) => a.d - b.d);
  const parent = rooms.map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { const ra = find(a); const rb = find(b); if (ra === rb) return false; parent[rb] = ra; return true; };
  const corridors = [];
  for (const e of edges) if (union(e.a, e.b)) corridors.push({ a: e.a, b: e.b, type: 'corridor' });
  for (const e of edges) {
    if (corridors.some(c => (c.a === e.a && c.b === e.b) || (c.a === e.b && c.b === e.a))) continue;
    if (rand() < 0.15) corridors.push({ a: e.a, b: e.b, type: 'loop' });
  }

  rooms[0].tag = 'entrance';
  rooms[1].tag = 'rest';
  rooms[2].tag = 'loot';
  const bossIndex = rooms.length - 1;
  rooms[bossIndex].tag = 'boss_arena';
  rooms[bossIndex].boss_id = bossId;
  rooms[bossIndex].canonical = true;
  const bossCenter = center(rooms[bossIndex]);
  rooms[rooms.length - 2].tag = 'elite';
  rooms.forEach((r, i) => {
    if (i > 2 && i < rooms.length - 2 && rand() < 0.15) r.tag = 'secret';
  });

  return {
    schema: 'kelplantis/dungeon/v1',
    floor_id: floorId,
    floor_version: version,
    generation_seed: seed,
    generation_style: 'bsp-like-room-graph-mst',
    width,
    height,
    rooms,
    corridors,
    boss_arena: { room_id: bossIndex, boss_id: bossId, x: bossCenter.x, y: bossCenter.y, canonical: true },
    provenance: { world_seed: worldSeed, floor_id: floorId, boss_id: bossId, generation_version: version }
  };
}

module.exports = { generateDungeon, hashSeed };
