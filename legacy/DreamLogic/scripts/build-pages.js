const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist-pages');

function rm(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function cp(src, dst) {
  fs.cpSync(src, dst, { recursive: true, force: true });
}

rm(OUT);
fs.mkdirSync(OUT, { recursive: true });

for (const name of fs.readdirSync(ROOT)) {
  if (!name.endsWith('.html')) continue;
  cp(path.join(ROOT, name), path.join(OUT, name));
}

for (const dir of ['assets', 'dreamiez', 'public']) {
  const src = path.join(ROOT, dir);
  if (fs.existsSync(src)) cp(src, path.join(OUT, dir));
}

console.log(`Cloudflare Pages static output prepared: ${OUT}`);
console.log('Excluded server source, Proof, catalog source data, scripts and repository metadata.');
