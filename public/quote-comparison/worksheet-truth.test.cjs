'use strict';
// Contract tests execute the actual inline browser arithmetic. No network, no payment.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = __dirname;
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const start = html.indexOf('function numericOrUnknown(v)');
const end = html.indexOf('function render()', start);
if (start < 0 || end <= start) throw new Error('MISSING_WORKSHEET_ARITHMETIC');

function calculate(rows) {
  const evaluate = new Function('items', 'sync', html.slice(start,end) + '; return read();');
  return evaluate(rows, () => {});
}

test('missing delivery is UNKNOWN, never secretly free', () => {
  assert.equal(calculate([{supplier:'A',price:'500',delivery:''}])[0].comparable_total, null);
});
test('included delivery is exactly the entered total', () => {
  const r=calculate([{supplier:'A',price:'500',delivery_mode:'included',delivery:''}])[0];
  assert.equal(r.comparable_total,500);
});
test('separate delivery is added only with a provided amount', () => {
  const r=calculate([{supplier:'A',price:'500',delivery_mode:'separate',delivery:'45'}])[0];
  assert.equal(r.comparable_total,545);
  const missing=calculate([{supplier:'B',price:'500',delivery_mode:'separate'}])[0];
  assert.equal(missing.comparable_total,null);
});
test('zero is valid only when explicitly entered as separate delivery',()=>{
  assert.equal(calculate([{price:'500',delivery_mode:'separate',delivery:'0'}])[0].comparable_total,500);
});
test('blank, negative, NaN and nonfinite totals never enter ranking',()=>{
  for(const v of ['', '-1','NaN','Infinity']) {
    assert.equal(calculate([{price:v,delivery_mode:'included'}])[0].comparable_total,null);
  }
});
test('export includes delivery status so unknown is retained',()=>{
  assert.match(html,/keys=\['supplier','price','delivery_mode','delivery','comparable_total'/);
});
test('the actual page script compiles',()=>{
  const js=html.split('<script>')[1]?.split('</script>')[0];
  assert.ok(js,'expected script'); assert.doesNotThrow(()=>new Function(js));
});
test('ten category pages no longer direct a buyer to unverified paid automation',()=>{
  const cats=['construction','ecommerce','electrical','hospitality','import','lighting','manufacturing','operations','packaging','wholesale'];
  for(const c of cats) {
    const src=fs.readFileSync(path.join(ROOT,c+'.html'),'utf8');
    assert.doesNotMatch(src, /buy\.stripe\.com|NZ\$49|Zero operator fulfilment|Automated procurement/);
    assert.match(src, /href="\/quote-comparison\/"/);
    assert.match(src, /FREE/);
  }
});
