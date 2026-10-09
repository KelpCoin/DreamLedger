import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePair } from "../scripts/carbon_forward_matcher.mjs";
const now = "2026-10-09T00:00:00.000Z";
const evidence = () => [{kind:"CONTRACT_DRAFT",uri_or_digest:"sha256:abcdef012345",verification_status:"VERIFIED",verified_at:"2026-10-01T00:00:00.000Z"}];
const make = (side, intent_id) => ({intent_id,side,quantity_nzu:side==="BUY_FORWARD"?1000:800,
 delivery_window:{start_date:"2027-01-01",end_date:"2027-12-31"},
 price_basis:{currency:"NZD",unit:"NZU",kind:"FIXED",price_per_nzu:42},
 counterparty_visibility:"BLINDED_UNTIL_MATCH",evidence:evidence(),
 consent:{data_processing:true,matching_only:true,recorded_at:"2026-10-01T00:00:00.000Z"}});
test("compatible pair produces non-binding proposal",()=>{const r=evaluatePair(make("BUY_FORWARD","buyer-0001"),make("SELL_FORWARD","seller-0001"),{now});assert.equal(r.decision,"MATCH_PROPOSED");assert.equal(r.binding,false);assert.equal(r.requires_human_review,true);assert.equal(r.terms.quantity_nzu,800);});
test("stale evidence blocks",()=>{const b=make("BUY_FORWARD","buyer-0001");b.evidence[0].verified_at="2024-01-01T00:00:00.000Z";const r=evaluatePair(b,make("SELL_FORWARD","seller-0001"),{now});assert.equal(r.code,"EVIDENCE_STALE");});
test("revoked consent blocks",()=>{const s=make("SELL_FORWARD","seller-0001");s.consent.revoked=true;const r=evaluatePair(make("BUY_FORWARD","buyer-0001"),s,{now});assert.equal(r.code,"CONSENT_BLOCKED");});
test("pair order does not change digest",()=>{const b=make("BUY_FORWARD","buyer-0001"),s=make("SELL_FORWARD","seller-0001");assert.equal(evaluatePair(b,s,{now}).match_id,evaluatePair(s,b,{now}).match_id);});
test("fixed price mismatch blocks",()=>{const s=make("SELL_FORWARD","seller-0001");s.price_basis.price_per_nzu=43;assert.equal(evaluatePair(make("BUY_FORWARD","buyer-0001"),s,{now}).code,"PRICE_MISMATCH");});
