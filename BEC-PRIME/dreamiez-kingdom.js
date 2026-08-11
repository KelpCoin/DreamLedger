'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dreamiezAccount = require('./dreamiez-account');

const ROOT = dreamiezAccount.dataRoot;
const TERRITORY = path.join(ROOT, 'territory.json');
const RESOURCES = path.join(ROOT, 'resources.json');
const GUILDS = path.join(ROOT, 'guilds.json');
const SEASON = path.join(ROOT, 'season.json');
const FEED = path.join(ROOT, 'feed.jsonl');
const WIDTH = 100;
const HEIGHT = 100;
const MAX_LEVEL = 10;
const DAY = 24 * 60 * 60 * 1000;

function now() { return new Date().toISOString(); }
function dayKey(date = new Date()) { return date.toISOString().slice(0, 10); }
function id(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }
function read(file, fallback) { fs.mkdirSync(ROOT, { recursive: true }); if (!fs.existsSync(file)) { write(file, fallback); return fallback; } return JSON.parse(fs.readFileSync(file, 'utf8')); }
function write(file, value) { fs.mkdirSync(ROOT, { recursive: true }); const tmp = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8'); fs.renameSync(tmp, file); }
function appendFeed(event) { fs.mkdirSync(ROOT, { recursive: true }); fs.appendFileSync(FEED, JSON.stringify({ event_id: id('evt'), at: now(), ...event }) + '\n', 'utf8'); }
function defaults() {
  return {
    width: WIDTH, height: HEIGHT, version: 2, tiles: {},
    rules: { max_level: MAX_LEVEL, challenge_per_guild_per_day: 1, shield_hours: 24, claim_cost: 0 }
  };
}
function resourceDefaults() { return { version: 2, users: {}, materials: {}, crafting: {} }; }
function guildDefaults() { return { version: 2, guilds: {}, memberships: {}, challenges: {} }; }
function seasonDefaults() { return { version: 2, season: 1, started_at: now(), ends_at: new Date(Date.now() + 30 * DAY).toISOString(), rewards: { guild_top_10: 'SEASON_GUILD_RELIC', player_top_50: 'SEASON_PLAYER_CROWN' } }; }
function ensureStores() { read(TERRITORY, defaults()); read(RESOURCES, resourceDefaults()); read(GUILDS, guildDefaults()); read(SEASON, seasonDefaults()); if (!fs.existsSync(FEED)) fs.writeFileSync(FEED, '', 'utf8'); }
function tileKey(x, y) { return `${x},${y}`; }
function validCoord(x, y) { return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT; }
function adjacent(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1; }
function publicTile(t) { return t ? { x: t.x, y: t.y, owner_id: t.owner_id, guild_id: t.guild_id, level: t.level, shield_until: t.shield_until || null, claimed_at: t.claimed_at } : null; }
function findUserTile(territory, accountId) { return Object.values(territory.tiles).find(t => t.owner_id === accountId) || null; }
function ensureUser(account) {
  ensureStores();
  const territory = read(TERRITORY, defaults());
  const resources = read(RESOURCES, resourceDefaults());
  if (!resources.users[account.account_id]) resources.users[account.account_id] = { dust: 0, last_accrual: now(), inventory: {}, active_at: now() };
  resources.users[account.account_id].active_at = now();
  let tile = findUserTile(territory, account.account_id);
  if (!tile) {
    const n = Object.keys(territory.tiles).length;
    const start = (account.account_id.replace(/-/g, '').slice(0, 8) || '0');
    let seed = parseInt(start, 16) % (WIDTH * HEIGHT);
    for (let i = 0; i < WIDTH * HEIGHT && territory.tiles[tileKey(seed % WIDTH, Math.floor(seed / WIDTH))]; i++) seed = (seed + 7919) % (WIDTH * HEIGHT);
    const x = seed % WIDTH; const y = Math.floor(seed / WIDTH);
    tile = { x, y, owner_id: account.account_id, guild_id: null, level: 1, claimed_at: now(), shield_until: null };
    territory.tiles[tileKey(x, y)] = tile;
    appendFeed({ type: 'territory_claimed', account_id: account.account_id, x, y });
  }
  write(TERRITORY, territory); write(RESOURCES, resources);
  return { territory, resources, tile };
}
function auth(req, res) { const account = dreamiezAccount.currentAccount(req); if (!account) { res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: 'Authentication required' })); return null; } return account; }
function send(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
async function body(req) { let s = ''; for await (const chunk of req) { s += chunk; if (s.length > 100000) throw new Error('Request too large'); } return JSON.parse(s || '{}'); }
function dustPerHour(level) { return 2 + level * 3; }
function materializeUser(resources, territory, accountId) {
  const u = resources.users[accountId]; if (!u) return 0;
  const tile = Object.values(territory.tiles).find(t => t.owner_id === accountId);
  const rate = dustPerHour(tile ? tile.level : 1);
  const elapsed = Math.max(0, Date.now() - new Date(u.last_accrual || now()).getTime());
  const hours = Math.min(elapsed / (60 * 60 * 1000), 24 * 7);
  const earned = Math.floor(hours * rate);
  if (earned > 0) { u.dust += earned; u.last_accrual = now(); }
  return earned;
}
function guildFor(guilds, accountId) { const membership = guilds.memberships[accountId]; return membership ? guilds.guilds[membership.guild_id] || null : null; }
function activeMembers(guilds, guild) { return Object.values(guilds.memberships).filter(m => m.guild_id === guild.guild_id && Date.now() - new Date(m.active_at || 0).getTime() < DAY).length; }
function guildPower(guilds, territory, resources, guild) {
  const members = Object.values(guilds.memberships).filter(m => m.guild_id === guild.guild_id);
  const tiles = Object.values(territory.tiles).filter(t => t.guild_id === guild.guild_id);
  const levels = tiles.reduce((n, t) => n + t.level, 0);
  const dust = members.reduce((n, m) => n + ((resources.users[m.account_id] || {}).dust || 0), 0);
  return 10 + levels * 4 + activeMembers(guilds, guild) * 8 + Math.floor(dust / 100);
}
function createGuild(account, name) {
  const guilds = read(GUILDS, guildDefaults());
  if (guilds.memberships[account.account_id]) throw new Error('Already in a guild');
  const clean = String(name || '').trim().slice(0, 32); if (!clean) throw new Error('Guild name required');
  if (Object.values(guilds.guilds).some(g => g.name.toLowerCase() === clean.toLowerCase())) throw new Error('Guild name already exists');
  const guild = { guild_id: id('guild'), name: clean, leader_id: account.account_id, created_at: now(), member_cap: 20 };
  guilds.guilds[guild.guild_id] = guild; guilds.memberships[account.account_id] = { guild_id: guild.guild_id, role: 'leader', joined_at: now(), active_at: now() }; write(GUILDS, guilds); appendFeed({ type: 'guild_created', guild_id: guild.guild_id, guild_name: guild.name, account_id: account.account_id }); return guild;
}
function challenge(account, targetX, targetY) {
  const { territory, resources } = ensureUser(account); const guilds = read(GUILDS, guildDefaults()); const guild = guildFor(guilds, account.account_id);
  if (!guild || guild.leader_id !== account.account_id) throw new Error('Guild leader required');
  if (!validCoord(targetX, targetY)) throw new Error('Invalid target tile');
  const target = territory.tiles[tileKey(targetX, targetY)]; if (!target || !target.guild_id || target.guild_id === guild.guild_id) throw new Error('Target must be an occupied enemy tile');
  if (!adjacent(findUserTile(territory, account.account_id), target)) throw new Error('Target must be adjacent to your territory');
  if (target.shield_until && new Date(target.shield_until).getTime() > Date.now()) throw new Error('Target is protected');
  const key = `${guild.guild_id}:${dayKey()}`; if (guilds.challenges[key]) throw new Error('Guild challenge already used today');
  const defender = guilds.guilds[target.guild_id]; if (!defender) throw new Error('Defending guild missing');
  const attackerPower = guildPower(guilds, territory, resources, guild); const defenderPower = guildPower(guilds, territory, resources, defender);
  const attackRoll = crypto.randomInt(1, 101) + attackerPower; const defendRoll = crypto.randomInt(1, 101) + defenderPower;
  const won = attackRoll >= defendRoll;
  guilds.challenges[key] = { guild_id: guild.guild_id, target: tileKey(targetX, targetY), at: now(), won, attack_roll: attackRoll, defend_roll: defendRoll };
  if (won) { target.guild_id = guild.guild_id; target.level = Math.max(1, Math.floor(target.level * 0.5)); target.shield_until = null; } else { target.shield_until = new Date(Date.now() + DAY).toISOString(); }
  write(GUILDS, guilds); write(TERRITORY, territory); appendFeed({ type: 'territory_challenge', guild_id: guild.guild_id, target_guild_id: defender.guild_id, x: targetX, y: targetY, won });
  return { won, attacker_power: attackerPower, defender_power: defenderPower, attack_roll: attackRoll, defend_roll: defendRoll, tile: publicTile(target) };
}
function upgrade(account) {
  const { territory, resources, tile } = ensureUser(account); const u = resources.users[account.account_id]; materializeUser(resources, territory, account.account_id);
  if (tile.level >= MAX_LEVEL) throw new Error('Territory is already level 10');
  const cost = 25 * tile.level * tile.level; if (u.dust < cost) throw new Error(`Need ${cost} Dream Dust`); u.dust -= cost; tile.level += 1; u.last_accrual = now(); write(TERRITORY, territory); write(RESOURCES, resources); appendFeed({ type: 'territory_upgraded', account_id: account.account_id, x: tile.x, y: tile.y, level: tile.level }); return { tile: publicTile(tile), dust: u.dust, cost };
}
function craft(account, recipe) {
  const { territory, resources } = ensureUser(account); const u = resources.users[account.account_id]; materializeUser(resources, territory, account.account_id);
  const recipes = { HAT_COMMON: { dust: 100, material: 'thread', qty: 2, output: 'hat_common' }, PET_SPARK: { dust: 300, material: 'spark', qty: 3, output: 'pet_spark' }, CROWN_SEASONAL: { dust: 1000, material: 'crown_shard', qty: 5, output: 'season_crown' } };
  const r = recipes[String(recipe || '')]; if (!r) throw new Error('Unknown recipe'); const have = Number(u.inventory[r.material] || 0); if (u.dust < r.dust || have < r.qty) throw new Error('Insufficient crafting materials'); u.dust -= r.dust; u.inventory[r.material] = have - r.qty; u.inventory[r.output] = Number(u.inventory[r.output] || 0) + 1; write(RESOURCES, resources); appendFeed({ type: 'cosmetic_crafted', account_id: account.account_id, item: r.output }); return { item: r.output, dust: u.dust, inventory: u.inventory };
}
function seasonInfo() { const season = read(SEASON, seasonDefaults()); const territory = read(TERRITORY, defaults()); const guilds = read(GUILDS, guildDefaults()); const guildScores = Object.values(guilds.guilds).map(g => ({ guild_id: g.guild_id, name: g.name, territory: Object.values(territory.tiles).filter(t => t.guild_id === g.guild_id).reduce((n, t) => n + t.level, 0) })).sort((a, b) => b.territory - a.territory); return { ...season, leaderboard: guildScores.slice(0, 10) }; }
function feed(limit) { if (!fs.existsSync(FEED)) return []; return fs.readFileSync(FEED, 'utf8').trim().split('\n').filter(Boolean).slice(-(Math.min(Number(limit) || 50, 100))).reverse().map(x => JSON.parse(x)); }
async function handle(req, res) {
  const url = req.url.split('?')[0]; if (!url.startsWith('/api/dreamiez/')) return false;
  try {
    if (req.method === 'GET' && url === '/api/dreamiez/territory') { const account = auth(req, res); if (!account) return true; const { territory, resources, tile } = ensureUser(account); materializeUser(resources, territory, account.account_id); write(RESOURCES, resources); const adjacentTiles = Object.values(territory.tiles).filter(t => Math.abs(t.x - tile.x) + Math.abs(t.y - tile.y) <= 1).map(publicTile); return send(res, 200, { width: WIDTH, height: HEIGHT, tile: publicTile(tile), adjacent: adjacentTiles, claimed_count: Object.keys(territory.tiles).length }); }
    if (req.method === 'POST' && url === '/api/dreamiez/territory/upgrade') { const account = auth(req, res); if (!account) return true; return send(res, 200, { ok: true, ...upgrade(account) }); }
    if (req.method === 'GET' && url === '/api/dreamiez/resources') { const account = auth(req, res); if (!account) return true; const { territory, resources } = ensureUser(account); materializeUser(resources, territory, account.account_id); write(RESOURCES, resources); return send(res, 200, { ok: true, ...resources.users[account.account_id] }); }
    if (req.method === 'POST' && url === '/api/dreamiez/guild/create') { const account = auth(req, res); if (!account) return true; const b = await body(req); return send(res, 201, { ok: true, guild: createGuild(account, b.name) }); }
    if (req.method === 'POST' && url === '/api/dreamiez/guild/challenge') { const account = auth(req, res); if (!account) return true; const b = await body(req); return send(res, 200, { ok: true, ...challenge(account, Number(b.x), Number(b.y)) }); }
    if (req.method === 'GET' && url === '/api/dreamiez/guild/me') { const account = auth(req, res); if (!account) return true; const guilds = read(GUILDS, guildDefaults()); const guild = guildFor(guilds, account.account_id); return send(res, 200, { ok: true, guild, members: guild ? Object.values(guilds.memberships).filter(m => m.guild_id === guild.guild_id) : [] }); }
    if (req.method === 'POST' && url === '/api/dreamiez/craft') { const account = auth(req, res); if (!account) return true; const b = await body(req); return send(res, 200, { ok: true, ...craft(account, b.recipe) }); }
    if (req.method === 'GET' && url === '/api/dreamiez/season') return send(res, 200, seasonInfo());
    if (req.method === 'GET' && url === '/api/dreamiez/feed') return send(res, 200, { events: feed(new URL(req.url, 'http://dreamiez.local').searchParams.get('limit')) });
    return false;
  } catch (err) { return send(res, 400, { error: err.message || 'Dreamiez kingdom request failed' }); }
}

module.exports = { handle, ensureStores, materializeUser, defaults, resourceDefaults, guildDefaults, seasonDefaults, paths: { ROOT, TERRITORY, RESOURCES, GUILDS, SEASON, FEED } };
