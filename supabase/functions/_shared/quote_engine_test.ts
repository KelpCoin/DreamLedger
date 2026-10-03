import { assertEquals, assert } from "jsr:@std/assert";
import { parseNumber, extractTotal, parseQuote, compareQuotes, evidencePacket } from "./quote_engine.ts";

const A="Supplier: Alpha Ltd\nGrand total: NZ$ 1,200.00 (excl. GST)\nMOQ: 10\nLead time: 14 days\nPayment terms: 30 days";
const B="Supplier: Beta Ltd\nSubtotal: 900\nTotal: 1,150.50 NZD excl GST\nMOQ: 5\nLead time: 7 days\nPayment terms: 20 days";
const USD="Supplier: Gamma Inc\nTotal: USD 800.00\nMOQ: 1\nLead time: 3 days\nPayment terms: net 30";
const INCL="Supplier: Delta\nTotal: NZD 1,300 incl. GST\nMOQ: 1\nLead time: 3 days\nPayment terms: 7 days";
const BARE="Supplier: Eps\nTotal: 999\nMOQ: 1\nLead time: 1 day\nPayment terms: now";

Deno.test("number formats",()=>{assertEquals(parseNumber("1,234.56"),1234.56);assertEquals(parseNumber("1.234,56"),1234.56);assertEquals(parseNumber("1,234"),1234);assertEquals(parseNumber("12,5"),12.5)});
Deno.test("total extraction handles prefix and suffix",()=>{assertEquals([extractTotal(A).amount,extractTotal(A).currency],[1200,"NZD"]);assertEquals([extractTotal(B).amount,extractTotal(B).currency],[1150.5,"NZD"]);assertEquals(extractTotal(USD).currency,"USD")});
Deno.test("same currency and basis compares",()=>{const c=compareQuotes([parseQuote("a",A),parseQuote("b",B)]);assert(c.comparable);assertEquals(c.lowest_total?.file,"b");assertEquals(c.total_spread,49.5);assertEquals(c.delivery_class,"COMPLETE")});
Deno.test("mixed currency does not rank",()=>{const c=compareQuotes([parseQuote("a",A),parseQuote("g",USD)]);assert(c.exceptions.some(e=>e.type==="MIXED_CURRENCY"));assertEquals(c.total_spread,null);assertEquals(c.lowest_total,null);assertEquals(c.evidence_verdict,"MISMATCH")});
Deno.test("unstated currency does not rank",()=>{const c=compareQuotes([parseQuote("a",A),parseQuote("e",BARE)]);assert(c.exceptions.some(e=>e.type==="CURRENCY_UNSTATED"));assertEquals(c.comparable,false);assertEquals(c.total_spread,null);assertEquals(c.lowest_total,null)});
Deno.test("symbol-only currency does not rank",()=>{const usd="Supplier: U\nTotal: $800";const cad="Supplier: C\nTotal: $900";const c=compareQuotes([parseQuote("u",usd),parseQuote("c",cad)]);assert(c.exceptions.some(e=>e.type==="CURRENCY_AMBIGUOUS"));assertEquals(c.comparable,false);assertEquals(c.total_spread,null)});
Deno.test("mixed tax basis is high",()=>{const c=compareQuotes([parseQuote("a",A),parseQuote("d",INCL)]);assert(c.exceptions.some(e=>e.type==="TAX_BASIS_MIXED"));assertEquals(c.delivery_class,"PARTIAL")});
Deno.test("insufficient input is not fulfilled",()=>{const c=compareQuotes([parseQuote("a",A),parseQuote("x","")]);assertEquals(c.delivery_class,"INSUFFICIENT");assertEquals(c.refund_review_required,true);assertEquals(c.evidence_verdict,"INSUFFICIENT_EVIDENCE")});
Deno.test("evidence packet is deterministic and makes no economic claim",async()=>{const inputs=[{file:"a",text:A},{file:"b",text:B}],c=compareQuotes(inputs.map(i=>parseQuote(i.file,i.text)));const p1=await evidencePacket(inputs,c,"T"),p2=await evidencePacket(inputs,c,"T");assertEquals(p1.packet_hash,p2.packet_hash);assertEquals(p1.revenue_claimed,false);assertEquals(p1.external_action_performed,false);assertEquals(c.evidence_status,"UNVERIFIED")});
