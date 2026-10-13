#!/usr/bin/env node
import assert from "node:assert/strict";

const base = process.env.VERIFY_NZBN_URL ?? "https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/verify-nzbn";
const forbidden = [/FOSSIL_PRIVATE_KEY_JWK/i, /SUPABASE_SERVICE_ROLE_KEY=/i, /NZBN_API_KEY=/i, /sk_live_[A-Za-z0-9]+/i];
const cases = [
  { name: "short NZBN", method: "POST", body: { nzbn: "123" }, expected: 400 },
  { name: "too-long NZBN", method: "POST", body: { nzbn: "12345678901234567890" }, expected: 400 },
  { name: "HTML injection", method: "POST", body: { nzbn: "<script>alert(1)</script>" }, expected: 400 },
  { name: "missing NZBN", method: "POST", body: {}, expected: 400 },
  { name: "SQL-like input", method: "POST", body: { nzbn: "'; DROP TABLE nzbn_checks; --" }, expected: 400 },
  { name: "wrong method", method: "GET", expected: 405 },
];

let failed = 0;
for (const test of cases) {
  try {
    const response = await fetch(base, {
      method: test.method,
      headers: test.body ? { "content-type": "application/json" } : {},
      body: test.body ? JSON.stringify(test.body) : undefined,
      signal: AbortSignal.timeout(12000),
    });
    const body = await response.text();
    assert.equal(response.status, test.expected, `${test.name}: expected HTTP ${test.expected}, received ${response.status}; body=${body.slice(0, 180)}`);
    assert.ok(body.length <= 6000, `${test.name}: response exceeded 6000 characters`);
    for (const pattern of forbidden) assert.ok(!pattern.test(body), `${test.name}: response matched secret canary ${pattern}`);
    console.log(`PASS ${test.name} HTTP ${response.status}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${test.name}: ${error.message}`);
  }
}
console.log(JSON.stringify({ target: base, total: cases.length, failed, status: failed ? "FAIL" : "PASS" }, null, 2));
if (failed) process.exitCode = 1;
