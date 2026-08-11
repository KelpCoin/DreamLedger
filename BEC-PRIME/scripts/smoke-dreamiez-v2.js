'use strict';

const fs = require('fs');
const path = require('path');
const kingdom = require('../dreamiez-kingdom');

const result = {
  checked_at: new Date().toISOString(),
  verdict: 'PASS',
  checks: []
};
function check(name, ok, detail) { result.checks.push({ name, ok: !!ok, detail }); if (!ok) result.verdict = 'FAIL'; }
try {
  kingdom.ensureStores();
  const files = [
    kingdom.paths.TERRITORY,
    kingdom.paths.RESOURCES,
    kingdom.paths.GUILDS,
    kingdom.paths.SEASON,
    kingdom.paths.FEED
  ];
  files.forEach(file => check(path.basename(file), fs.existsSync(file), file));
  const territory = JSON.parse(fs.readFileSync(kingdom.paths.TERRITORY, 'utf8'));
  const resources = JSON.parse(fs.readFileSync(kingdom.paths.RESOURCES, 'utf8'));
  const guilds = JSON.parse(fs.readFileSync(kingdom.paths.GUILDS, 'utf8'));
  const season = JSON.parse(fs.readFileSync(kingdom.paths.SEASON, 'utf8'));
  check('territory_100x100', territory.width === 100 && territory.height === 100, `${territory.width}x${territory.height}`);
  check('sparse_tile_store', territory.tiles && typeof territory.tiles === 'object', 'claimed tiles only');
  check('resource_store', resources.version === 2 && resources.users && resources.materials, 'version 2');
  check('guild_store', guilds.version === 2 && guilds.guilds && guilds.memberships, 'version 2');
  check('season_store', season.version === 2 && Number(season.season) >= 1 && season.ends_at, 'active season');
  check('no_heavy_dependency', !fs.existsSync(path.join(__dirname, '..', 'node_modules')), 'Dreamiez V2 uses Node built-ins only');
} catch (err) {
  result.verdict = 'FAIL';
  result.error = err.message;
}
const proofPath = path.join(__dirname, '..', `PROOF-${new Date().toISOString().slice(0, 10)}-DREAMIEZ-V2.json`);
fs.writeFileSync(proofPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ ...result, proof_path: proofPath }, null, 2));
process.exitCode = result.verdict === 'PASS' ? 0 : 1;
