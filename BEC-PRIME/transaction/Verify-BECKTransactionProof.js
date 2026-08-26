'use strict';

const fs = require('fs');
const path = require('path');
const { BECKTransactionKernel } = require('./BECKTransactionKernel');
const { sha256 } = require('./TransactionStore');

const root = path.resolve(process.env.BECK_DATA_DIR || path.join(__dirname, '..', 'data', 'beck'));
const transactionId = process.argv[2];
if (!transactionId) { console.error('Usage: node transaction/Verify-BECKTransactionProof.js <transaction_id>'); process.exit(2); }
const kernel = new BECKTransactionKernel({ rootDir:root });
try {
  const ledger = kernel.verify(transactionId);
  const proofPath = path.join(root,'proof',transactionId+'.json');
  let proof = { ok:false, reason:'PROOF_MISSING' };
  if (fs.existsSync(proofPath)) {
    const value=JSON.parse(fs.readFileSync(proofPath,'utf8')); const supplied=value.proof_hash; delete value.proof_hash;
    const calculated=sha256(JSON.stringify(value)); proof={ ok:supplied===calculated, path:proofPath, supplied_hash:supplied, calculated_hash:calculated };
  }
  const result={ transaction_id:transactionId, ledger, proof, pass:ledger.ok && proof.ok };
  console.log(JSON.stringify(result,null,2)); process.exitCode=result.pass?0:1;
} finally { kernel.close(); }
