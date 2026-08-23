const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const src = path.join(root, 'index.html');
const out = path.join(root, 'dist', 'index.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.copyFileSync(src, out);
console.log(`Surface compiled to ${out}`);
