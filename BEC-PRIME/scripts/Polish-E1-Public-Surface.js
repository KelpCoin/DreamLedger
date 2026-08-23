'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'compiled', 'website', 'index.html');

if (!fs.existsSync(INDEX)) {
  throw new Error('E1 compiled public index is missing: ' + INDEX);
}

let html = fs.readFileSync(INDEX, 'utf8');

const replacements = [
  ['A useful answer, not a 40-page fog bank.', 'A concise answer you can act on.'],
  ['Practical output</strong><span>Prioritized actions, not theory sludge.', 'Practical output</strong><span>Prioritized actions, clearly stated.'],
  ['The Agentic Sovereignty Diagnostic is a focused evidence review for businesses building or operating agentic commerce. We inspect the available proof, expose trust gaps, and return the highest-value actions.', 'The Agentic Sovereignty Diagnostic is a focused evidence review for businesses building or operating agentic commerce. We separate observable evidence from assumptions, identify trust gaps, and return the highest-value actions.'],
  ['Four questions. One inspectable picture.', 'Four questions. One evidence picture.']
];

for (const [from, to] of replacements) {
  html = html.split(from).join(to);
}

const polish = `\n<style id="dreamledger-e1-polish">\n/* E1 commercial polish: restrained, premium, mobile-first. */\n:root{--bg:#f7f7f5;--ink:#0b0d12;--muted:#5f636b;--line:#e3e3df;--card:#ffffff;--accent:#8b5cf6;--green:#16704d;--shadow:0 24px 70px rgba(11,13,18,.10)}\nbody{letter-spacing:-.005em}\n.shell{max-width:1180px}\n.topbar{height:82px}\n.brand{font-size:23px}\n.brand span{color:var(--accent)}\n.toplink{padding:8px 0}\n.hero{gap:64px;padding:78px 0 64px}\n.kicker{background:#fff;border-color:#e1e1dc;box-shadow:0 3px 12px rgba(11,13,18,.04)}\nh1{font-weight:850;max-width:760px}\nh1 em{color:var(--accent)}\n.lede{max-width:650px;color:#565a62}\n.actions{gap:16px}.primary{min-height:54px;padding:0 26px;border-radius:13px;background:#0b0d12;box-shadow:0 10px 26px rgba(11,13,18,.16)}\n.primary:hover{transform:translateY(-1px);background:#171a21}\n.offer{border-radius:24px;box-shadow:0 28px 80px rgba(11,13,18,.16)}\n.offer:before{background:radial-gradient(circle,rgba(139,92,246,.30),rgba(139,92,246,0) 68%)}\n.offer .buy{border-radius:12px}\n.trustbar{background:rgba(255,255,255,.42)}\n.trust{padding:22px 20px}\n.section{padding:92px 0}\nh2.section-title{font-weight:820}\n.evidence{border-radius:16px;box-shadow:0 5px 20px rgba(11,13,18,.035);transition:transform .18s ease,box-shadow .18s ease}\n.evidence:hover{transform:translateY(-2px);box-shadow:0 14px 32px rgba(11,13,18,.07)}\n.deliver,.process-card{box-shadow:0 5px 20px rgba(11,13,18,.035)}\n.final{border-radius:24px;box-shadow:0 24px 70px rgba(11,13,18,.14)}\n.final .primary{border-radius:12px}\nfooter{padding-bottom:76px}\n@media(max-width:620px){\n  .topbar{height:64px}\n  .hero{padding:48px 0 42px;gap:28px}\n  h1{font-size:50px;line-height:.96}\n  .lede{font-size:17px;line-height:1.55}\n  .actions{display:grid;grid-template-columns:1fr;gap:8px}.actions .primary{text-align:center;width:100%}.secondary{text-align:center}\n  .offer{box-shadow:0 20px 55px rgba(11,13,18,.14)}\n  .section{padding:58px 0}\n  .mobile-cta a{background:#0b0d12;border-color:#0b0d12}\n}\n@media(prefers-reduced-motion:reduce){.evidence{transition:none}.primary:hover{transform:none}}\n</style>\n`;

if (!html.includes('id="dreamledger-e1-polish"')) {
  html = html.replace('</head>', polish + '</head>');
}

fs.writeFileSync(INDEX, html, 'utf8');
console.log(JSON.stringify({status:'PASS', file:INDEX, polish:'applied'}, null, 2));
