'use strict';

const crypto = require('crypto');

function hashSeed(worldSeed, floorId, bossId, version) {
  return crypto.createHash('sha256').update(`${worldSeed}:${floorId}:${bossId}:${version}`, 'utf8').digest('hex');
}

function rngFromHex(hex) {
  let state = Number.parseInt(hex.slice(0, 8), 16) >>> 0;
  return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 0x100000000; };
}

function generateDungeon(input) {
  const floorId = Number(input.floor_id);
  const version = String(input.floor_version || '1');
  const bossId = String(input.canonical_boss_id || `kelp_floor${floorId}_boss`);
  const worldSeed = String(input.world_seed || 'kelplantis');
  const width = Number(input.width || 80);
  const height = Number(input.height || 50);
  const count = Math.max(8, Math.min(30, Number(input.room_count || 14)));
  const seed = hashSeed(worldSeed, floorId, bossId, version);
  const rand = rngFromHex(seed);

  const rooms = [];
  const splits = [{ x: 1, y: 1, w: width - 2, h: height - 2 }];
  while (splits.length < count) {
    let best = -1;
    for (let i = 0; i < splits.length; i += 1) if (splits[i].w >= 14 || splits[i].h >= 12) { best = i; break; }
    if (best < 0) break;
    const r = splits.splice(best, 1)[0];
    const vertical = r.w >= r.h;
    if (vertical && r.w >= 14) {
      const cut = Math.max(7, Math.min(r.w - 7, Math.floor(r.w * (0.4 + rand() * 0.2))));
      splits.push({ x:r.x, y:r.y, w:cut, h:r.h }, { x:r.x + cut, y:r.y, w:r.w - cut, h:r.h });
    } else if (r.h >= 12) {
      const cut = Math.max(6, Math.min(r.h - 6, Math.floor(r.h * (0.4 + rand() * 0.2))));
      splits.push({ x:r.x, y:r.y, w:r.w, h:cut }, { x:r.x, y:r.y + cut, w:r.w, h:r.h - cut });
    } else break;
  }

  for (let i = 0; i < splits.length; i += 1) {
    const cell = splits[i];
    const padX = 2 + Math.floor(rand() * 2), padY = 2 + Math.floor(rand() * 2);
    rooms.push({ id:i, x:cell.x + padX, y:cell.y + padY, w:Math.max(4, cell.w - padX * 2), h:Math.max(4, cell.h - padY * 2), tag:'combat' });
  }

  const center = r => ({ x:r.x + r.w / 2, y:r.y + r.h / 2 });
  const distance = (a,b) => Math.hypot(center(a).x - center(b).x, center(a).y - center(b).y);
  const edges = [];
  for (let i = 0; i < rooms.length; i += 1) for (let j = i + 1; j < rooms.length; j += 1) edges.push({ a:i, b:j, d:distance(rooms[i], rooms[j]) });
  edges.sort((a,b) => a.d - b.d);

  const parent = rooms.map((_,i) => i);
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a,b) => { const ra=find(a), rb=find(b); if (ra===rb) return false; parent[rb]=ra; return true; };
  const corridors = [];
  for (const e of edges) if (union(e.a,e.b)) corridors.push({ a:e.a, b:e.b, type:'corridor' });
  for (const e of edges) {
    if (corridors.some(c => (c.a===e.a && c.b===e.b) || (c.a===e.b && c.b===e.a))) continue;
    if (rand() < 0.15) corridors.push({ a:e.a, b:e.b, type:'loop' });
  }

  const adjacency = rooms.map(() => []);
  for (const c of corridors) { adjacency[c.a].push(c.b); adjacency[c.b].push(c.a); }
  const distances = Array(rooms.length).fill(Infinity);
  distances[0] = 0;
  const queue = [0];
  for (let qi=0; qi<queue.length; qi+=1) { const n=queue[qi]; for (const next of adjacency[n]) if (distances[next]===Infinity) { distances[next]=distances[n]+1; queue.push(next); } }
  const bossIndex = distances.reduce((best,d,i) => d > distances[best] ? i : best, rooms.length - 1);

  rooms.forEach(r => { r.tag='combat'; delete r.boss_id; delete r.canonical; });
  const reserved = new Set([bossIndex]);
  const entranceIndex = 0;
  rooms[entranceIndex].tag='entrance';
  reserved.add(entranceIndex);
  const restIndex = rooms.findIndex(r => !reserved.has(r.id));
  if (restIndex >= 0) { rooms[restIndex].tag='rest'; reserved.add(restIndex); }
  const lootIndex = rooms.findIndex(r => !reserved.has(r.id));
  if (lootIndex >= 0) { rooms[lootIndex].tag='loot'; reserved.add(lootIndex); }
  const eliteCandidates = rooms.filter(r => !reserved.has(r.id));
  const eliteIndex = eliteCandidates.length ? eliteCandidates[eliteCandidates.length - 1].id : -1;
  if (eliteIndex >= 0) { rooms[eliteIndex].tag='elite'; reserved.add(eliteIndex); }
  rooms[bossIndex].tag='boss_arena';
  rooms[bossIndex].boss_id=bossId;
  rooms[bossIndex].canonical=true;
  for (const r of rooms) if (!reserved.has(r.id) && rand() < 0.15) r.tag='secret';

  const populations = rooms.map(r => {
    const table = r.tag==='boss_arena' ? 'boss' : r.tag==='elite' ? 'elite' : r.tag==='loot' ? 'loot' : 'trash';
    const countMin = table==='boss' ? 3 : table==='elite' ? 2 : table==='trash' ? 1 : 0;
    const countMax = table==='boss' ? 5 : table==='elite' ? 4 : table==='trash' ? 3 : 0;
    return { room_id:r.id, room_tag:r.tag, enemy_pool:table==='boss'?['goblin_champion','goblin_archer']:['goblin','goblin_archer'], enemy_count:[countMin,countMax], loot_table:`floor${floorId}_${table}`, chest:r.tag==='loot'||r.tag==='boss_arena' };
  });

  return { schema:'kelplantis/dungeon/v2', floor_id:floorId, floor_version:version, generation_seed:seed, generation_style:'bsp-room-graph-mst', width, height, rooms, corridors, populations, boss_arena:{ room_id:bossIndex, boss_id:bossId, canonical:true, reachable_distance:distances[bossIndex] }, provenance:{ world_seed:worldSeed, floor_id:floorId, boss_id:bossId, generation_version:version } };
}

module.exports = { generateDungeon, hashSeed };
