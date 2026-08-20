'use strict';

const crypto = require('crypto');

function floorKey(floorId) { return `kelplantis.floor.${Number(floorId)}`; }

function canonicalGenerationRecord(input) {
  const floorId = Number(input.floor_id);
  const worldSeed = String(input.world_seed || 'kelplantis');
  const bossId = String(input.canonical_boss_id || input.boss_id || `kelp_floor${floorId}_boss`);
  const version = String(input.generation_version || input.floor_version || '1');
  const generationSeed = input.generation_seed || crypto.createHash('sha256').update(`${worldSeed}:${floorId}:${bossId}:${version}`, 'utf8').digest('hex');
  return { floor_id:floorId, generation_seed:generationSeed, generation_version:version, boss_id:bossId, first_generated_at_utc:input.first_generated_at_utc || null, historical_events:Array.isArray(input.historical_events) ? input.historical_events.slice() : [], canonical_boss_arena_locked:Boolean(input.canonical_boss_arena_locked) };
}

function appendHistoricalEvent(record, event) {
  if (!event || !event.type) throw new Error('historical event type is required');
  const next = canonicalGenerationRecord(record);
  next.historical_events.push({ event_id:event.event_id || crypto.createHash('sha256').update(JSON.stringify(event), 'utf8').digest('hex').slice(0,16), type:String(event.type), at_utc:event.at_utc || new Date().toISOString(), payload:event.payload || {} });
  if (event.type === 'BOSS_CLEARED') next.canonical_boss_arena_locked = true;
  return next;
}

module.exports = { floorKey, canonicalGenerationRecord, appendHistoricalEvent };
