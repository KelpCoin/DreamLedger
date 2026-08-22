'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const elohim = require('../elohim/ElohimV6');

function digest(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function checkArtifact(filePath, kind = 'html') {
  if (!filePath) throw new Error('artifact path required');
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`artifact missing: ${abs}`);
  const stat = fs.statSync(abs);
  if (!stat.isFile() || stat.size < 256) throw new Error('artifact too small');
  const text = fs.readFileSync(abs, 'utf8');
  const checks = {
    exists: true,
    nontrivial: stat.size >= 256,
    deterministic_read: typeof text === 'string',
    html_shell: kind !== 'html' || /<!doctype html/i.test(text),
    viewport: kind !== 'html' || /<meta[^>]+name=["']viewport["']/i.test(text),
    game_loop: kind !== 'html' || /(requestAnimationFrame|setInterval|addEventListener)/i.test(text),
    no_obvious_secret: !/(sk_(live|test)_|whsec_|BEGIN (RSA|EC|OPENSSH|PRIVATE KEY))/i.test(text)
  };
  const verdict = Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
  return {
    schema: 'BEC-COMPILER-LEVERAGE-GAUNTLET/v1',
    verdict,
    checks,
    artifact: {
      path: abs,
      kind,
      bytes: stat.size,
      sha256: digest(text)
    }
  };
}

async function gate({ artifact, kind = 'html', compiler = 'UniversalCompiler' }) {
  const gauntlet = checkArtifact(artifact, kind);
  const proposal = await elohim.propose({
    compiler,
    artifact: { path: artifact, kind },
    gauntlet: gauntlet.verdict,
    objective: 'maximize deterministic quality while preserving approval boundaries'
  });
  return {
    schema: 'BEC-COMPILER-QUALITY-GATE/v1',
    verdict: gauntlet.verdict === 'PASS' ? 'PASS' : 'FAIL',
    gauntlet,
    elohim_proposal_id: proposal.proposal_id,
    generated_at: new Date().toISOString()
  };
}

module.exports = { checkArtifact, gate };
