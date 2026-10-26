import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { hashArtifactBytes } from './artifact-hash.mjs';
if (!globalThis.crypto) globalThis.crypto = webcrypto;

test('hash matches exactly the bytes sent in the canonical CSV', async () => {
  const csv = '"file","supplier"\n"quote a","Supplier A"';
  const bytes = new TextEncoder().encode(csv);
  const expected = createHash('sha256').update(bytes).digest('hex');
  assert.equal(await hashArtifactBytes(bytes), expected);
  assert.match(expected, /^[0-9a-f]{64}$/);
  assert.notEqual(await hashArtifactBytes(new TextEncoder().encode(csv+'\n')), expected);
});
test('hash helper requires byte data and never guesses encoding', async () => {
  await assert.rejects(() => hashArtifactBytes('CSV content'), /ARTIFACT_BYTES_REQUIRED/);
});
test('existing quote-fulfillment stores CSV byte hash without claiming successful delivery', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /const csvBytes=new TextEncoder\(\)\.encode\(csv\(rows\)\)/);
  assert.match(source, /hashArtifactBytes\(csvBytes\)/);
  assert.match(source, /new Blob\(\[csvBytes\]/);
  assert.match(source, /csv_sha256:csvSha256/);
  assert.match(source, /evidence_status:"UNVERIFIED"/);
  assert.match(source, /revenue_claimed:false/);
});
