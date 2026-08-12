'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSET = path.join(ROOT, 'compiled', 'website', 'assets', 'marketplace-live.js');

if (!fs.existsSync(ASSET)) throw new Error('Price display patch input missing: compiled/website/assets/marketplace-live.js');

let source = fs.readFileSync(ASSET, 'utf8');
const before = "const money=(n,c='NZD')=>`${c} ${Number(n||0).toFixed(2)}`;";
const legacyAfter = "const money=(n,c='NZD')=>{const raw=Number(n||0);const amount=(Number.isInteger(raw)&&raw>=1000)?raw/100:raw;return `${c} ${amount.toFixed(2)}`;};";
const currentAfter = "const money=(v,c='NZD')=>`${String(c||'NZD').toUpperCase()} ${(Number(v||0)/100).toFixed(2)}`;";

if (source.includes(legacyAfter) || source.includes(currentAfter) || source.includes('raw/100')) {
  console.log('Price display patch already satisfied.');
  process.exit(0);
}
if (!source.includes(before)) throw new Error('Expected marketplace money formatter was not found; refusing unsafe rewrite.');
source = source.replace(before, legacyAfter);
fs.writeFileSync(ASSET, source, 'utf8');
console.log('Price display patch applied.');
