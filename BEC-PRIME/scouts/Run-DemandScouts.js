'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const CONFIG = path.join(__dirname, 'demand-sources.json');
const OUT_DIR = path.join(ROOT, 'data', 'scout-evidence');
const OUT = path.join(OUT_DIR, 'DEMAND-SCOUT-RESULT.json');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'BEC-PRIME-Demand-Scout/1.0', 'Accept': 'application/vnd.github+json' }
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error(`Invalid JSON from ${url}: ${e.message}`)); }
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error(`Timeout: ${url}`)));
    req.on('error', reject);
  });
}

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function tokens(text) { return String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9_-]{2,}/g) || []; }
function score(item, signals) {
  const text = `${item.title || ''} ${item.body || ''} ${item.name || ''} ${item.tag_name || ''}`.toLowerCase();
  return signals.reduce((n, s) => n + (text.includes(s.toLowerCase()) ? 1 : 0), 0);
}

async function main() {
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const evidence = [];
  const failures = [];

  for (const source of cfg.sources) {
    try {
      const payload = await get(source.url);
      const rows = Array.isArray(payload) ? payload : [payload];
      const ranked = rows.map(row => ({
        source_id: source.id,
        category: source.category,
        id: row.id || row.node_id || null,
        title: row.title || row.name || row.tag_name || null,
        url: row.html_url || row.url || null,
        score: score(row, source.signals),
        token_count: tokens(`${row.title || ''} ${row.body || ''}`).length,
        observed_at: new Date().toISOString()
      })).sort((a, b) => b.score - a.score).slice(0, 20);
      evidence.push(...ranked);
    } catch (err) {
      failures.push({ source_id: source.id, error: err.message });
    }
  }

  // The runner records evidence timestamps because this is an observation artifact.
  // It never writes offers, unlocks checkout, posts externally, or mutates customer data.
  const clusters = {};
  for (const row of evidence) {
    if (row.score < 2) continue;
    const key = `${row.category}:${row.title || 'untitled'}`.slice(0, 160);
    clusters[key] = (clusters[key] || 0) + 1;
  }

  const result = {
    schema: 'bec-prime/demand-scout-result/v1',
    verdict: failures.length && !evidence.length ? 'FAIL' : 'PASS',
    read_only: true,
    activation_locked: true,
    public_posting: false,
    sources_checked: cfg.sources.length,
    evidence_count: evidence.length,
    failures,
    repeated_signal_candidates: Object.entries(clusters)
      .filter(([, count]) => count >= 2)
      .map(([cluster, count]) => ({ cluster, count }))
      .sort((a, b) => b.count - a.count),
    evidence_hash: hash(evidence),
    evidence
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({
    verdict: result.verdict,
    sources_checked: result.sources_checked,
    evidence_count: result.evidence_count,
    repeated_signal_candidates: result.repeated_signal_candidates.length,
    output: path.relative(ROOT, OUT)
  }, null, 2));

  if (result.verdict !== 'PASS') process.exit(1);
}

main().catch(err => { console.error(err.stack || err.message); process.exit(1); });
