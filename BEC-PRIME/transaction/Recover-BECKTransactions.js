'use strict';

const path = require('path');
const { BECKTransactionKernel } = require('./BECKTransactionKernel');

const root = path.resolve(process.env.BECK_DATA_DIR || path.join(__dirname, '..', 'data', 'beck'));
const kernel = new BECKTransactionKernel({ rootDir:root });
try {
  const results = kernel.recoverAll();
  const output = { schema_version:'1.0', action:'BECK_RECOVERY', root, recovered:results.length, results, at:new Date().toISOString() };
  console.log(JSON.stringify(output,null,2));
  process.exitCode = results.some(r => !r.ok || r.state !== 'PROOF_FINALIZED') ? 1 : 0;
} finally { kernel.close(); }
