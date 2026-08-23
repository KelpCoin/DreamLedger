const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist-pages');
const required = ['index.html', 'mtg.html', 'login.html', 'register.html'];
const forbidden = ['server.js', 'package.json', 'Proof', 'catalog', 'scripts', '.github'];
const checks = [];

for (const file of required) checks.push({ check: `required:${file}`, pass: fs.existsSync(path.join(OUT, file)) });
for (const file of forbidden) checks.push({ check: `not_public:${file}`, pass: !fs.existsSync(path.join(OUT, file)) });
checks.push({ check: 'pages_function:api', pass: fs.existsSync(path.join(ROOT, 'functions', 'api', '[[path]].js')) });
checks.push({ check: 'pages_function:healthz', pass: fs.existsSync(path.join(ROOT, 'functions', 'healthz.js')) });
checks.push({ check: 'routes_config', pass: fs.existsSync(path.join(ROOT, '_routes.json')) });
checks.push({ check: 'wrangler_config', pass: fs.existsSync(path.join(ROOT, 'wrangler.toml')) });

const pass = checks.every(x => x.pass);
const proof = {
  schema: 'DREAMLEDGER-CLOUDFLARE-PAGES-1',
  status: pass ? 'PASS' : 'FAIL',
  timestamp_utc: new Date().toISOString(),
  static_output: 'dist-pages',
  backend_mode: 'Cloudflare Pages static storefront with API/health proxy to existing backend',
  checks
};

const proofDir = path.join(ROOT, 'Proof', 'Cloudflare');
fs.mkdirSync(proofDir, { recursive: true });
fs.writeFileSync(path.join(proofDir, 'cloudflare-pages-proof.json'), JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(proof, null, 2));
if (!pass) process.exit(1);
