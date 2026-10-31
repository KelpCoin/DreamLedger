import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const script=resolve('scripts/quote-compare-49-from-worksheet.mjs');
const fixture=resolve('tests/fixtures/quote-compare-49-worksheet.json');
const sha=b=>createHash('sha256').update(b).digest('hex');
async function run(data){
 const dir=await mkdtemp(join(tmpdir(),'quote49-test-'));
 const input=join(dir,'input.json');
 await writeFile(input,JSON.stringify(data));
 const command=()=>spawnSync(process.execPath,[script,'--input',input,'--output',join(dir,'out')],{encoding:'utf8'});
 return {dir,command,input};
}
test('produces repeatable private draft and valid byte-for-byte SHA256 evidence',async()=>{
 const data=JSON.parse(await readFile(fixture,'utf8'));const x=await run(data);
 try{
  const a=x.command();assert.equal(a.status,0,a.stderr);
  const first=JSON.parse(a.stdout);assert.equal(first.status,'DRAFT_NOT_PAID_OR_DELIVERED');
  const summary=await readFile(join(first.folder,'summary.md'),'utf8');
  assert.match(summary,/delivery unknown; not fully comparable/);
  assert.match(summary,/VERIFY Stripe paid event/);
  assert.doesNotMatch(summary,/payment verified|customer paid/i);
  const csv=await readFile(join(first.folder,'comparison.csv'),'utf8');
  assert.match(csv,/FICTIONAL SUPPLIER A/);
  const receipt=JSON.parse(await readFile(join(first.folder,'receipt.json'),'utf8'));
  assert.equal(receipt.expected_price_nzd,49);assert.equal(receipt.silo,'truth_oracle');
  assert.equal(receipt.payment_checked,false);assert.equal(receipt.human_approved,false);
  assert.equal(receipt.customer_delivery_confirmed,false);
  assert.equal(receipt.artifacts['summary.md'],sha(summary));
  assert.equal(receipt.artifacts['comparison.csv'],sha(csv));
  assert.equal(receipt.source_sha256,sha(await readFile(x.input)));
  const b=x.command();assert.equal(b.status,0,b.stderr);
  const second=JSON.parse(b.stdout);assert.equal(first.folder,second.folder);
  assert.equal(csv,await readFile(join(second.folder,'comparison.csv'),'utf8'));
 }finally{await rm(x.dir,{recursive:true,force:true})}
});
test('rejects untrusted source status and incomplete supplier records',async()=>{
 const sample=JSON.parse(await readFile(fixture,'utf8'));
 for(const payload of [
  {...sample,truth_status:'VERIFIED_PAID'},
  {...sample,quotes:sample.quotes.slice(0,1)},
  {...sample,quotes:[{...sample.quotes[0],price:-10},sample.quotes[1]]},
  {...sample,quotes:[{...sample.quotes[0],supplier:''},sample.quotes[1]]}
 ]){
  const x=await run(payload);try{const r=x.command();assert.notEqual(r.status,0)}finally{await rm(x.dir,{recursive:true,force:true})}
 }
});
test('CSV injection payload is escaped as plain text',async()=>{
 const sample=JSON.parse(await readFile(fixture,'utf8'));
 sample.quotes[1].supplier='=HYPERLINK("https://evil.example")';
 const x=await run(sample);try{
  const r=x.command();assert.equal(r.status,0,r.stderr);
  const folder=JSON.parse(r.stdout).folder;const csv=await readFile(join(folder,'comparison.csv'),'utf8');
  assert.match(csv,/"'=HYPERLINK/);
 }finally{await rm(x.dir,{recursive:true,force:true})}
});
