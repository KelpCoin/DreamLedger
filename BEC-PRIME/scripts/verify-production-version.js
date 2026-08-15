'use strict';

const https = require('https');

const base = (process.env.PRODUCTION_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
const expected = process.env.EXPECTED_COMMIT || process.env.GITHUB_SHA || '';
const timeoutMs = Number(process.env.PRODUCTION_VERSION_TIMEOUT_MS || 15000);

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'DreamLedger-production-version-verifier/1.0' } }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} from ${url}: ${body.slice(0, 300)}`));
        try { resolve(JSON.parse(body)); } catch { reject(new Error(`Non-JSON response from ${url}`)); }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timeout after ${timeoutMs}ms: ${url}`)));
    req.on('error', reject);
  });
}

(async () => {
  const data = await getJson(`${base}/version`);
  if (data.service !== 'dreamledger') throw new Error('Production /version service mismatch.');
  if (!data.commit || data.commit === 'unknown') throw new Error('Production /version did not identify its commit.');
  if (expected && data.commit !== expected) throw new Error(`DEPLOYMENT SHA MISMATCH: expected ${expected}, live ${data.commit}`);
  if (!data.environment) throw new Error('Production /version missing environment.');
  if (!data.build_timestamp) throw new Error('Production /version missing build timestamp.');
  console.log(JSON.stringify({
    status: 'PASS',
    base,
    live_commit: data.commit,
    expected_commit: expected || null,
    environment: data.environment,
    build_timestamp: data.build_timestamp
  }, null, 2));
})().catch(err => {
  console.error(JSON.stringify({ status: 'FAIL', base, error: err.message }, null, 2));
  process.exit(1);
});
