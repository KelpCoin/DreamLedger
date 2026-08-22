'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'compiled', 'website');

const targets = [
  'index.html',
  'dreamiez.html',
  'dreamiez-dashboard.html'
];

for (const name of targets) {
  const file = path.join(PUBLIC, name);
  if (!fs.existsSync(file)) continue;
  let text = fs.readFileSync(file, 'utf8');
  text = text
    .replace(/\bDreamiez\b/g, 'DreamMeez')
    .replace(/\bDREAMIEZ\b/g, 'DREAMMEEZ')
    .replace(/href="\/dreamiez"/g, 'href="/dreammeez"')
    .replace(/href='\/dreamiez'/g, "href='/dreammeez'");

  if (name === 'index.html' && !text.includes('href="/cortex.html"')) {
    text = text.replace('<nav class="links">', '<nav class="links"><a href="/cortex.html">Cortex</a>');
  }
  fs.writeFileSync(file, text, 'utf8');
}

const alias = path.join(PUBLIC, 'dreammeez.html');
if (!fs.existsSync(alias)) {
  fs.writeFileSync(alias, '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/dreamiez"><link rel="canonical" href="/dreammeez"></head><body>DreamMeez</body></html>\n', 'utf8');
}
console.log('PASS: DreamMeez public branding and Cortex navigation patch applied.');
