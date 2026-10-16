import test from "node:test";
import assert from "node:assert/strict";
import {verifyQuoteComparison} from "./quote-verifier.js";
const quotes=[
  {supplier:"A",amount:100,currency:"NZD",line_items:[],timestamp:"2026-10-06T00:00:00Z"},
  {supplier:"B",amount:120,currency:"NZD",line_items:[],timestamp:"2026-10-06T00:00:00Z"}
];
test("same inputs produce byte-stable hashes",()=>{
  const a=verifyQuoteComparison({quotes,claimed_comparison:{cheapest:"A"}});
  const b=verifyQuoteComparison({quotes,claimed_comparison:{cheapest:"A"}});
  assert.equal(a.status,"VERIFIED"); assert.equal(a.receipt_hash,b.receipt_hash); assert.equal(a.evidence_hash,b.evidence_hash);
});
test("wrong cheapest is contradicted",()=>{
  const r=verifyQuoteComparison({quotes,claimed_comparison:{cheapest:"B"}});
  assert.equal(r.status,"CONTRADICTED"); assert.equal(r.actual_cheapest,"A"); assert.equal(r.deviation,0.2);
});
test("one quote is insufficient",()=>{
  const r=verifyQuoteComparison({quotes:[quotes[0]],claimed_comparison:{cheapest:"A"}});
  assert.equal(r.status,"INSUFFICIENT_DATA");
});
