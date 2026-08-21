'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const source = path.join(repoRoot, 'cinema.html');
const outputDir = path.join(__dirname, '..', 'compiled', 'website');
const output = path.join(outputDir, 'cinema.html');

if (!fs.existsSync(source)) throw new Error(`Cinema source missing: ${source}`);
const html = fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n');
if (!html.includes('<title>DreamLedger Cinema</title>')) throw new Error('Cinema title marker missing');
if (!html.includes('schema_version')) throw new Error('Cinema schema marker missing');
if (/https?:\/\//i.test(html)) throw new Error('Cinema source contains a network URL');

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(output, html, 'utf8');

console.log(JSON.stringify({
  status: 'PASS',
  source: 'cinema.html',
  output: 'BEC-PRIME/compiled/website/cinema.html',
  bytes: Buffer.byteLength(html, 'utf8')
}, null, 2));
