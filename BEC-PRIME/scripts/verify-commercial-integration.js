'use strict';
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..');
const required = [
  'README.md',
  'CONTROL-PLANE/COMMERCIAL-INTEGRATION.md',
  'CONTROL-PLANE/LM-STUDIO-MULTI-LLM.md',
  'IP/MASTER-IP-MAP.md',
  'IP/PUBLIC-IP-MANIFEST.md',
  'IP/QR/QR-DESTINATION.txt',
  'MARKETS/MARKET-MATRIX.md',
  'SOCIAL/SOCIAL-VIRALITY-PLAYBOOK.md',
  'BEC-PRIME/scripts/meta-gauntlet-current.js',
  '.github/workflows/pc-off-refinement-gauntlet.yml'
];
const failures = [];
for (const rel of required) if (!fs.existsSync(path.join(repo, rel))) failures.push(`MISSING=${rel}`);
const readme = fs.readFileSync(path.join(repo, 'README.md'), 'utf8');
const integration = fs.readFileSync(path.join(repo, 'CONTROL-PLANE/COMMERCIAL-INTEGRATION.md'), 'utf8');
if (!readme.includes('https://dreamledger.org')) failures.push('README_DREAMLEDGER_URL=FAIL');
if (!readme.includes('https://amplissa.com')) failures.push('README_AMPLISSA_URL=FAIL');
if (!readme.includes('https://buy.stripe.com/28EcN54zraG13M3g3idwc1t')) failures.push('README_STRIPE_LINK=FAIL');
if (!integration.includes('APPROVAL-GATED')) failures.push('APPROVAL_GATE=FAIL');
if (!integration.includes('Automation may compile, test, lint, package, generate QR assets')) failures.push('AUTOMATION_BOUNDARY=FAIL');

const status = failures.length ? 'FAIL' : 'PASS';
const lines = [
  'DREAMLEDGER COMMERCIAL INTEGRATION PROOF',
  `STATUS=${status}`,
  `UTC=${new Date().toISOString()}`,
  'PUBLIC_SURFACE=dreamledger.org',
  'BRAND_SURFACE=amplissa.com',
  'LOCAL_LLM=LM_STUDIO_WHEN_PC_ON',
  'PC_OFF_CONTINUITY=GITHUB_ACTIONS',
  'GAUNTLET=REQUIRED',
  'SOCIAL_PUBLICATION=APPROVAL_GATED',
  'REVENUE_CLAIM=NOT_VERIFIED_BY_AUTOMATION',
  ...failures
];
console.log(lines.join('\n'));
if (process.env.PROOF_OUT) fs.writeFileSync(process.env.PROOF_OUT, lines.join('\n') + '\n', 'utf8');
process.exit(failures.length ? 1 : 0);
