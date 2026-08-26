'use strict';

const fs = require('fs');
const path = require('path');
const universal = require('../universal/UniversalExtractor');

const config = universal.loadConfig();
if (config.default_policy !== 'deny') throw new Error('UNIVERSAL_GATE_FAILED: default policy must be deny');
if (!config.sources.some(s => s.id === 'ebay' && s.enabled === true)) throw new Error('UNIVERSAL_GATE_FAILED: ebay source missing');
if (config.sources.some(s => s.enabled === true && config.blocked_capabilities.includes('credential_bypass') === false)) throw new Error('UNIVERSAL_GATE_FAILED: safety policy missing');

const rankedShape = universal.normalizeCandidate({ id: 'x1', title: 'FUBU jacket XL', price: '99', currency: 'AUD', url: 'https://example.invalid/x1' }, 'test');
if (rankedShape.schema !== 'candidate-item-v1') throw new Error('UNIVERSAL_GATE_FAILED: candidate schema');
if (rankedShape.price !== 99) throw new Error('UNIVERSAL_GATE_FAILED: numeric price normalization');

const matches = universal.patternMatch('FUBU jacket XL NZ$120', {
  brand: 'fubu',
  size: 'xl',
  price: 'NZ\\$\\d+'
});
if (!matches.brand.length || !matches.size.length || !matches.price.length) throw new Error('UNIVERSAL_GATE_FAILED: pattern matching');
if (universal.sourceAllowed('does-not-exist')) throw new Error('UNIVERSAL_GATE_FAILED: unknown source allowed');

const proofDir = path.join(process.env.UNIVERSAL_PROOF_DIR || path.join(__dirname, '..', '..', 'data', 'universal-proof'));
fs.mkdirSync(proofDir, { recursive: true });
const proof = {
  schema: 'universal-extraction-proof-v1',
  status: 'PASS',
  timestamp: new Date().toISOString(),
  checks: ['deny-by-default', 'source-registry', 'candidate-normalization', 'pattern-matching', 'unknown-source-block']
};
const file = path.join(proofDir, 'UNIVERSAL-EXTRACTION-PROOF-' + Date.now() + '.json');
fs.writeFileSync(file, JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ ...proof, proof_file: file }, null, 2));
