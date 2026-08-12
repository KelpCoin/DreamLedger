'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSET = path.join(ROOT, 'compiled', 'website', 'assets', 'marketplace-live.js');

if (!fs.existsSync(ASSET)) throw new Error('Price display patch input missing: compiled/website/assets/marketplace-live.js');

let source = fs.readFileSync(ASSET, 'utf8');
const beforeLegacy = "const money=(n,c='NZD')=>`${c} ${Number(n||0).toFixed(2)}`;";
const beforeCurrent = "const money=(v,c='NZD')=>`${String(c||'NZD').toUpperCase()} ${(Number(v||0)/100).toFixed(2)}`;";
const after = "const money=(n,c='NZD')=>{const raw=Number(n||0);const amount=(Number.isInteger(raw)&&raw>=1000)?raw/100:raw;return `${c} ${amount.toFixed(2)}`;};";

if (source.includes(after)) {
  console.log('Price display patch already applied.');
  process.exit(0);
}
if (source.includes(beforeCurrent)) {
  source = source.replace(beforeCurrent, after);
  fs.writeFileSync(ASSET, source, 'utf8');
  console.log('Price display patch migrated current formatter to cents-aware contract.');
  process.exit(0);
}
if (!source.includes(beforeLegacy)) throw new Error('Expected marketplace money formatter was not found; refusing unsafe rewrite.');
source = source.replace(beforeLegacy, after);
fs.writeFileSync(ASSET, source, 'utf8');
console.log('Price display patch applied.');
