'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'compiled', 'website', 'index.html');
const PROOF = path.join(ROOT, 'PROOF-SILO-DIRECTORY-LINK.json');

if (!fs.existsSync(INDEX)) throw new Error('Compiled public index missing. Run SurfaceCompiler first.');

let html = fs.readFileSync(INDEX, 'utf8');
const marker = 'href="/silos.html"';
const link = '<a href="/silos.html">Silos</a>';

if (!html.includes(marker)) {
  const navClose = html.indexOf('</nav>');
  if (navClose < 0) throw new Error('Public navigation contract missing </nav>.');
  html = html.slice(0, navClose) + link + html.slice(navClose);
}

fs.writeFileSync(INDEX, html, 'utf8');
fs.writeFileSync(PROOF, JSON.stringify({
  schema: 'BEC-PRIME/SILO-DIRECTORY-LINK/v1',
  status: 'PASS',
  target: '/silos.html',
  output: 'BEC-PRIME/compiled/website/index.html',
  compiled_at: new Date().toISOString()
}, null, 2) + '\n', 'utf8');

console.log('SILO_DIRECTORY_LINK=PASS');
