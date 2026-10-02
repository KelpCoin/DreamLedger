'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'compiled', 'website');

const REMOVE = [
  'api/_catalog.json',
  'cortex.html',
  'economic-loops.json',
  'economics/index.html',
  'economics/ip-manifest.json',
  'leverage-registry.html',
  'portfolio/gauntlet-as-a-service.html',
  'portfolio/index.html'
];

function remove(rel) {
  const target = path.join(PUBLIC, rel);
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

for (const rel of REMOVE) remove(rel);

const publicEconomicLoops = path.join(ROOT, '..', 'public', 'economic-loops.json');
if (fs.existsSync(publicEconomicLoops)) fs.rmSync(publicEconomicLoops, { force: true });

const avatar = path.join(PUBLIC, 'assets', 'avatar-runtime.js');
if (fs.existsSync(avatar)) {
  let raw = fs.readFileSync(avatar, 'utf8');
  raw = raw
    .replace(/It never bypasses Elohim, Gauntlet, or Approval Governor\./g, 'It always follows the account review and approval flow.')
    .replace(/\s*next_stage:\s*'ELOHIM_REFINERY',/g, '')
    .replace(/\s*approval_required:\s*true,/g, '\n        approval_required: true,');
  fs.writeFileSync(avatar, raw, 'utf8');
}

console.log(JSON.stringify({
  schema: 'dreamledger/public-surface-scrub/v1',
  removed: REMOVE,
  public_economic_loops_removed: !fs.existsSync(publicEconomicLoops),
  avatar_runtime_sanitized: !fs.existsSync(avatar) || !/ELOHIM|Gauntlet|Approval Governor/.test(fs.readFileSync(avatar, 'utf8'))
}, null, 2));
