import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const CLAIMS = path.join(ROOT, 'claims');
const OUT = path.join(ROOT, '..', 'BEC-PRIME', 'compiled', 'website', 'truth-oracle');

const sha256 = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const canonical = value => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.keys(value).sort().reduce((o, k) => { o[k] = canonical(value[k]); return o; }, {})
    : value;

function parseClaim(file) {
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`Invalid claim format: ${file}`);
  const front = {};
  for (const line of match[1].split('\n')) {
    const i = line.indexOf(':');
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    front[key] = value;
  }
  return { front, body: match[2].trim(), source_sha256: sha256(text) };
}

function statusFor(claim, now = Date.now()) {
  if (!claim.front.observed_at || !claim.front.valid_until) return 'MISSING';
  if (!claim.front.evidence_hash) return 'MISSING';
  if (Number.isNaN(Date.parse(claim.front.valid_until))) return 'MISSING';
  if (Date.parse(claim.front.valid_until) <= now) return 'STALE';
  if (claim.front.contradicted === 'true') return 'CONTRADICTED';
  return 'VERIFIED';
}

fs.mkdirSync(OUT, { recursive: true });
if (!fs.existsSync(CLAIMS)) throw new Error('Truth Oracle claims directory missing');

const files = fs.readdirSync(CLAIMS).filter(x => x.endsWith('.md')).sort();
const pages = [];
for (const file of files) {
  const claim = parseClaim(path.join(CLAIMS, file));
  const status = statusFor(claim);
  const title = claim.front.title || file.replace(/\.md$/, '');
  const statement = claim.front.statement || claim.body.split('\n')[0] || '';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><title>${title} | Truth Oracle</title><style>body{font-family:system-ui,sans-serif;max-width:820px;margin:0 auto;padding:32px;color:#17191d}article{line-height:1.6}.status{display:inline-block;padding:4px 9px;border:1px solid #bbb;border-radius:999px;font-size:.8rem;font-weight:700}small{color:#666}pre{white-space:pre-wrap}</style></head><body><p><a href="/truth-oracle/">Truth Oracle</a></p><article><h1>${title}</h1><p class="status">${status}</p><p><strong>${statement}</strong></p><p><small>Observed: ${claim.front.observed_at || 'not recorded'} · Valid until: ${claim.front.valid_until || 'not recorded'} · Evidence: ${claim.front.evidence_hash || 'not recorded'}</small></p><hr><pre>${claim.body.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre></article></body></html>`;
  fs.writeFileSync(path.join(OUT, file.replace(/\.md$/, '.html')), html, 'utf8');
  pages.push({ file, claim_id: claim.front.claim_id || null, title, status, source_sha256: claim.source_sha256, evidence_hash: claim.front.evidence_hash || null });
}

const manifest = {
  schema_version: '1.0',
  generated_at: new Date().toISOString(),
  source_of_truth: 'TRUTH-ORACLE/claims/*.md',
  pages,
  manifest_sha256: sha256(JSON.stringify(canonical(pages)))
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Truth Oracle | New Zealand savings reference</title></head><body><main><h1>Truth Oracle</h1><p>Evidence-backed New Zealand household savings reference.</p><ul>${pages.map(p => `<li><a href="/truth-oracle/${p.file.replace(/\.md$/, '.html')}">${p.title}</a> <strong>${p.status}</strong></li>`).join('')}</ul></main></body></html>`, 'utf8');
console.log(JSON.stringify({ status: 'PASS', pages: pages.length, manifest: manifest.manifest_sha256 }, null, 2));
