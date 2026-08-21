'use strict';

function installKelplantisCommerceUi() {
  const api = window.KELPLANTIS_RESULT;
  const game = window.__KELPLANTIS_TEST__;
  if (!api || !game) return;

  const bar = document.createElement('div');
  bar.id = 'commerce-controls';
  bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:8px 0';
  bar.innerHTML = '<button id="share-result">Share Result</button><button id="save-result-proof">Save Proof</button><button id="leaderboard">Local Leaderboard</button>';
  const canvas = document.getElementById('game');
  canvas.parentNode.insertBefore(bar, canvas);

  const leaderboardKey = 'dreamledger:kelplantis:leaderboard:v1';
  function readBoard() { try { return JSON.parse(localStorage.getItem(leaderboardKey) || '[]'); } catch (_) { return []; } }
  function writeBoard(board) { localStorage.setItem(leaderboardKey, JSON.stringify(board.slice(0, 20))); }
  function currentInput() {
    const s = game.snapshot().state;
    return { floor: 1, cleared: Boolean(s.win), level: s.level, kills: s.kills, xp: s.xp, gold: s.gold, loot_count: s.loot.length };
  }
  async function currentProof() { return api.proofForResult(currentInput()); }
  function download(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  document.getElementById('save-result-proof').onclick = async () => {
    const proof = await currentProof();
    download(`kelplantis-result-${proof.sha256.slice(0, 12)}.json`, JSON.stringify(proof, null, 2) + '\n', 'application/json');
  };

  document.getElementById('share-result').onclick = async () => {
    const proof = await currentProof();
    const svg = api.buildShareCardSvg(proof);
    const text = `Kelplantis Floor ${proof.result.floor} ${proof.result.cleared ? 'CLEARED' : 'RUN COMPLETE'} | Level ${proof.result.level} | ${proof.result.kills} kills | Proof ${proof.sha256.slice(0, 16)}`;
    const board = readBoard();
    board.push({ ...proof.result, proof: proof.sha256, at: new Date().toISOString() });
    board.sort((a, b) => (Number(b.floor) - Number(a.floor)) || (Number(b.level) - Number(a.level)) || (Number(b.kills) - Number(a.kills)) || (Number(b.xp) - Number(a.xp)));
    writeBoard(board);
    if (navigator.share) {
      try { await navigator.share({ title: 'Kelplantis Result', text }); return; } catch (_) {}
    }
    download(`kelplantis-result-${proof.sha256.slice(0, 12)}.svg`, svg, 'image/svg+xml');
  };

  document.getElementById('leaderboard').onclick = () => {
    const board = readBoard();
    const text = board.length ? board.slice(0, 10).map((r, i) => `${i + 1}. L${r.level} / ${r.kills} kills / ${r.xp} XP / ${r.proof.slice(0, 10)}`).join('\n') : 'No local results yet.';
    window.alert('Kelplantis Local Leaderboard\n\n' + text);
  };
}

if (typeof window !== 'undefined') window.installKelplantisCommerceUi = installKelplantisCommerceUi;
if (typeof module !== 'undefined') module.exports = { installKelplantisCommerceUi };
