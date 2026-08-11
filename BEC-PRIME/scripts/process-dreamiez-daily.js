'use strict';

const fs = require('fs');
const path = require('path');
const kingdom = require('../dreamiez-kingdom');

const { ROOT, TERRITORY, RESOURCES, GUILDS, SEASON, FEED } = kingdom.paths;
const DAY = 24 * 60 * 60 * 1000;
const MARKER = path.join(ROOT, 'daily-processor.json');

function read(file, fallback) { if (!fs.existsSync(file)) return fallback; return JSON.parse(fs.readFileSync(file, 'utf8')); }
function write(file, value) { const tmp = `${file}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8'); fs.renameSync(tmp, file); }
function appendFeed(event) { fs.appendFileSync(FEED, JSON.stringify({ event_id: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`, at: new Date().toISOString(), ...event }) + '\n', 'utf8'); }
function processDaily() {
  kingdom.ensureStores();
  const marker = read(MARKER, { version: 1, last_run_day: null });
  const today = new Date().toISOString().slice(0, 10);
  if (marker.last_run_day === today) return { ok: true, idempotent: true, day: today, awarded: 0 };
  const territory = read(TERRITORY, kingdom.defaults());
  const resources = read(RESOURCES, kingdom.resourceDefaults());
  let awarded = 0;
  for (const [accountId, user] of Object.entries(resources.users)) {
    const tile = Object.values(territory.tiles).find(t => t.owner_id === accountId);
    const level = tile ? tile.level : 1;
    const amount = 24 * (2 + level * 3);
    user.dust = Number(user.dust || 0) + amount;
    user.last_accrual = new Date().toISOString();
    awarded += amount;
  }
  const guilds = read(GUILDS, kingdom.guildDefaults());
  const expiredShields = Object.values(territory.tiles).filter(t => t.shield_until && new Date(t.shield_until).getTime() <= Date.now());
  expiredShields.forEach(t => { t.shield_until = null; });
  const season = read(SEASON, kingdom.seasonDefaults());
  let seasonReset = false;
  if (new Date(season.ends_at).getTime() <= Date.now()) {
    season.season += 1;
    season.started_at = new Date().toISOString();
    season.ends_at = new Date(Date.now() + 30 * DAY).toISOString();
    for (const tile of Object.values(territory.tiles)) tile.level = Math.max(1, Math.ceil(tile.level * 0.5));
    seasonReset = true;
    appendFeed({ type: 'season_reset', season: season.season });
  }
  marker.last_run_day = today;
  marker.last_run_at = new Date().toISOString();
  write(RESOURCES, resources); write(TERRITORY, territory); write(SEASON, season); write(MARKER, marker);
  appendFeed({ type: 'daily_distribution', awarded, users: Object.keys(resources.users).length, season: season.season });
  return { ok: true, idempotent: false, day: today, awarded, users: Object.keys(resources.users).length, expired_shields: expiredShields.length, season_reset: seasonReset, guilds: Object.keys(guilds.guilds).length };
}

if (require.main === module) console.log(JSON.stringify(processDaily(), null, 2));
module.exports = { processDaily };
