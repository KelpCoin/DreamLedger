'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const ROOT=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p));
const text=p=>read(p).toString('utf8');
const CANONICAL='https://dreamledger.org/?utm_source=qr&utm_medium=offline&utm_campaign=canonical';
// Git blob SHA is intentionally frozen to protect existing printed QR stickers.
const ORIGINAL_GIT_BLOB_SHA='e2c2a9000151e0e29b876f8b2a3af0b7278e8d87';

test('Single printed QR code bytes have not been changed by the factory',()=>{
  const bytes=read('public/qr/canonical.svg');
  const gitHash=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  assert.equal(gitHash,ORIGINAL_GIT_BLOB_SHA);
  assert.match(bytes.toString('utf8'),/viewBox="0 0 37 37"/);
});
test('Every named canonical QR asset is the very same QR matrix, never a placeholder',()=>{
  assert.deepEqual(read('public/assets/qr-canonical.svg'),read('public/qr/canonical.svg'));
  assert.doesNotMatch(text('public/assets/qr-canonical.svg'),/Run QRCompiler/);
});
test('Canonical QR viewer references this same symbol, never an independently generated QR',()=>{
  const html=text('BEC-PRIME/compiled/website/canonical-qr.html');
  assert.match(html,/src="\/qr\/canonical\.svg"/);
  assert.doesNotMatch(html,/data:image\/jpeg;base64/);
});
test('Single immutable code targets canonical door, while internal niche routing follows scan',()=>{
  const matrix=JSON.parse(text('BEC-PRIME/distribution/QR-DISTRIBUTION-MATRIX.json'));
  assert.equal(matrix.canonical.url,CANONICAL);
  const docs=text('ops/distribution/QR_CANONICAL_DISTRIBUTION.md');
  assert.ok(docs.includes(CANONICAL));
  assert.match(docs,/not the encoded QR payload/);
  assert.match(matrix.rule,/per-listing QR codes are forbidden/);
});
