import fs from 'node:fs';
import vm from 'node:vm';

const file = 'cinema.html';
const html = fs.readFileSync(file, 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/i);
if (!match) throw new Error('No inline script found');
const script = match[1];

if (/https?:\/\//i.test(html)) throw new Error('Network URL found in cinema.html');
if (/Math\.random\s*\(/.test(script)) throw new Error('Math.random() found in executable Cinema code');
for (const id of ['cfg-seed','cfg-a','cfg-b','cfg-turns','btn-generate','deck-a-name','deck-b-name','match-id','seed-display','turn-marker','event-line','progress-fill','btn-back','btn-playpause','btn-forward','btn-download-proof','btn-copy-proof','outcome','proof-json']) {
  if (!html.includes(`id=\"${id}\"`)) throw new Error(`Missing DOM id: ${id}`);
}

const stub = () => ({
  value: '', textContent: '', innerHTML: '', disabled: false, style: { width: '' },
  classList: { add() {}, remove() {} }, addEventListener() {}
});
const context = {
  console,
  setInterval: () => 1,
  clearInterval() {},
  requestAnimationFrame: fn => fn(),
  document: { getElementById: stub, querySelectorAll: () => [] },
  window: { location: { search: '' } },
  navigator: {},
  Blob: class {},
  URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }
};
vm.createContext(context);
new vm.Script(script, { filename: file }).runInContext(context);

const a = JSON.parse(vm.runInContext("JSON.stringify(generateFixture(12345, 'A', 'B', 10))", context));
const b = JSON.parse(vm.runInContext("JSON.stringify(generateFixture(12345, 'A', 'B', 10))", context));
const c = JSON.parse(vm.runInContext("JSON.stringify(generateFixture(12346, 'A', 'B', 10))", context));
if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('Same seed is not deterministic');
if (JSON.stringify(a) === JSON.stringify(c)) throw new Error('Different seed did not diverge');
if (a.schema_version !== 'cinema-event-v1') throw new Error('Schema mismatch');
if (a.events.length !== 10) throw new Error('Event count mismatch');
if (!['A','B'].includes(a.result.winner)) throw new Error('Invalid winner');
if (!a.result.winner_name) throw new Error('Missing winner name');

console.log('PASS cinema.html syntax');
console.log('PASS zero-network static surface');
console.log('PASS required DOM contract');
console.log('PASS deterministic same-seed reproduction');
console.log('PASS different-seed divergence');
console.log('PASS event schema and winner');
console.log('CINEMA_VERIFICATION=PASS');
