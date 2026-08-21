'use strict';

const crypto = require('crypto');

function canonicalResult(input) {
  const result = {
    game: 'Kelplantis',
    floor: Number(input.floor || 1),
    cleared: Boolean(input.cleared),
    level: Number(input.level || 1),
    kills: Number(input.kills || 0),
    xp: Number(input.xp || 0),
    gold: Number(input.gold || 0),
    loot_count: Number(input.loot_count || 0)
  };
  return result;
}

function proofForResult(input) {
  const result = canonicalResult(input);
  const canonical = JSON.stringify(result);
  return {
    schema: 'bec/kelplantis-result-proof/v1',
    result,
    sha256: crypto.createHash('sha256').update(canonical, 'utf8').digest('hex')
  };
}

function buildShareCardSvg(proof) {
  const r = proof.result;
  const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#07110b"/><rect x="48" y="48" width="1104" height="534" rx="28" fill="#102218" stroke="#4d8a61" stroke-width="2"/><text x="90" y="125" fill="#dff7e5" font-family="system-ui,sans-serif" font-size="54" font-weight="800">KELPLANTIS</text><text x="90" y="175" fill="#8fd5a2" font-family="system-ui,sans-serif" font-size="28">Floor ${esc(r.floor)} ${r.cleared ? 'CLEARED' : 'RUN COMPLETE'}</text><text x="90" y="275" fill="#fff" font-family="system-ui,sans-serif" font-size="34">Level ${esc(r.level)}  |  ${esc(r.kills)} kills  |  ${esc(r.xp)} XP</text><text x="90" y="330" fill="#fff" font-family="system-ui,sans-serif" font-size="30">${esc(r.gold)} gold  |  ${esc(r.loot_count)} loot items</text><text x="90" y="475" fill="#8fd5a2" font-family="monospace" font-size="18">PROOF ${esc(proof.sha256.slice(0, 32))}</text><text x="90" y="525" fill="#70957a" font-family="system-ui,sans-serif" font-size="18">DreamLedger verified result artifact</text></svg>`;
}

if (typeof window !== 'undefined') {
  window.KELPLANTIS_RESULT = { canonicalResult, proofForResult, buildShareCardSvg };
}

module.exports = { canonicalResult, proofForResult, buildShareCardSvg };
