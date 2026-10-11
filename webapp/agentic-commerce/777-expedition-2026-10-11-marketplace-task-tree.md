# 777 Expedition: Money-First Marketplace Task Tree
Date: 2026-10-11
Status: EXECUTION SPECIFICATION, NOT A CLAIM OF DEPLOYMENT OR REVENUE

## North-star contract
Find verified intent to pay, attach one bounded offer, collect an external settled payment, deliver the promised result, preserve evidence, and replicate only what works. The verified revenue counter remains NZ$0 until the evidence chain is complete.

WORLD SIGNAL -> PROVENANCE LEDGER -> AMBER ROOM -> QUALIFIED BUYING INTENT -> Q-SWARM (5-10 bounded tests) -> ELOHIM -> GAUNTLET -> ONE OFFER / ONE CTA -> AUTHORIZED CHECKOUT -> SETTLEMENT -> FULFILLMENT -> CUSTOMER-VERIFIABLE RECEIPT -> REPLICATION.

## Epic decomposition: work in small, independently testable cells

### Epic A: First settled dollar (P0)
1. Audit the existing NZ$29 Commander Deck Diagnostic and NZ$49 Quote-Compare purchase paths end-to-end.
2. For each path, verify destination URL, live checkout, SKU/price identity, payment success event, webhook receipt, idempotent order record, fulfillment instructions, and customer delivery evidence.
3. Select exactly one path that passes every pre-purchase and delivery check. Do not split traffic across competing CTAs.
4. If neither passes, repair the narrowest broken boundary and rerun tests with test-mode labels; never count tests as revenue.
5. Produce a run-scoped proof bundle: commit SHA, run URL, checkout destination, redacted event IDs, settlement status, fulfillment receipt, and remaining uncertainty.
Acceptance: one independently paid order is settled and delivered, or an exact failed boundary plus a tested repair and next proof is recorded. No false green.

### Epic B: Sentinel signal acquisition (P0)
1. Use permitted public sources and official feeds: procurement/tender notices, change logs, job/contract signals, product requests, buyer-authored posts, and public quote requests.
2. Capture source URL, observed time, publication time, immutable excerpt/hash, geography, entity, pain, urgency, budget/price evidence, contact/response route, and license/terms constraints.
3. Deduplicate by canonical URL, content hash, entity + problem + time window; retain raw evidence and a reasoned lineage record.
4. Classify evidence: VERIFIED, UNVERIFIED, CONTRADICTED, STALE, TEST, SIMULATED, INTERNAL, or UNMATCHED. A market-size statistic is not buying intent.
5. Exclude scraped personal data, private-group content without authorization, prohibited automation, and any outreach requiring a human's identity/consent gate.
Acceptance: every ranked signal is traceable to source evidence and has an explicit expiration/recheck rule.

### Epic C: Amber Room qualification (P0)
Score each signal on buying intent (30%), urgency (20%), reachability (15%), delivery readiness (15%), contribution margin (10%), repeat frequency (5%), and evidence quality (5%). These are starting heuristics, not calibrated probabilities.
- Hard reject: no identifiable buyer/problem, no lawful response route, unverifiable source, unclear delivery capability, negative/unknown variable-cost floor, or speculative regulated claims.
- Amber: promising but missing one decisive proof; specify the cheapest test to resolve it.
- Green-to-test: buyer-authored intent or direct request, bounded deliverable, plausible price anchor, reachable authorized channel, and a deliverable we can fulfill now.
- Archive: stale, duplicate, weak intent, or negative expected contribution after the test budget.
Never delete raw evidence. AI may cluster, redact, mark stale, recommend archive, and preserve the explanation; it must not rewrite uncertainty into fact.

### Epic D: Q-Swarm bounded experiments (P1)
For each qualified problem, generate 5-10 distinct offer/message/surface/CTA cells, changing one variable per cell. Prefer existing product rails and organic intent; no ad spend and no unsolicited personal outreach.
Every cell declares: hypothesis, buyer, trigger, offer, price, proof needed, allowed channel, budget ceiling, timeout, kill rule, and success event.
Stop cells early on no response, prohibited source, broken fulfillment, margin failure, or cost ceiling. Promote a cell only on observed buyer action; promote a mechanism only on paid and fulfilled evidence.

### Epic E: Agent Bridge commercial toll road (P1)
- Free B2B discovery; paid A2A execution only when a capability is real, authorized, metered, and observable.
- Capability manifest: provider, function, input/output schema, latency/availability, price, quotas, auth scope, data retention, refund/error policy, and evidence endpoint.
- Enforce per-key identity, signed entitlements, quotas, idempotency, cost attribution, timeout, abuse controls, and a global kill switch.
- Price each call above variable compute/provider cost plus failure/refund reserve; log gross, fees, refunds, compute, and contribution margin separately.
- Do not advertise unavailable capabilities or bill for model output alone when the promised result was not delivered.

### Epic F: GPU capacity, isolated and opt-in (P2)
Do not expose LM Studio or a local port directly to the internet. Build a queueing adapter behind authenticated cloud ingress, with allowlisted models/tasks, sandboxing, quotas, redacted inputs, secrets isolation, timeouts, resource ceilings, usage metering, and emergency stop. The local machine may be offline; the service must fail closed and report unavailable rather than silently switch.
Acceptance before sale: threat model, isolation tests, cost-per-job measurement, abuse tests, and positive contribution margin on representative jobs. User data is not reused for training without explicit permission.

### Epic G: Marketplace substrate and public compounding artifacts (P1/P2)
Build reusable commerce primitives, not a premature everything-store:
1. Identity/roles and verification levels (account, seller, transaction).
2. Product/service catalog with structured attributes and truthful availability.
3. Offers, quotes, checkout, refunds, order state machine, and fulfillment receipts.
4. Search/index, saved intent, buyer requests, seller responses, reputation grounded in completed transactions.
5. API/A2A capability registry and metered entitlements.
6. Reusable templates, stencils, word banks, schemas, neural-network/model adapters, and deterministic validators.
7. Programmatic DOOH as a later inventory-and-proof module: screen owner authorization, inventory, creative approval, impression proof, billing, privacy, and dispute handling.
Do not claim parity with Trade Me, eBay, Amazon, Shopify, or Facebook until actual feature, safety, liquidity, support, and transaction evidence exists. Build the narrow primitive that removes the next verified buying friction.

## Execution policy
- First cash outranks architectural expansion.
- One silo, one CTA, one commercial wall.
- No direct personal outreach, paid ads, or up-front spend.
- Never infer payment from checkout sessions, payment intents, internal records, green workflows, traffic, or model outputs.
- No bulk programmatic SEO filler. Publish only evidence-rich, distinct artifacts with citations, original analysis, canonical URLs, and useful internal links; cohort-gate by indexing, qualified visits, and buyer action.
- Each 777 cycle must emit either (a) one non-duplicate, evidence-rich component with tests and a publication path, or (b) a run-scoped no-op receipt that says why no safe new artifact qualified.
- Track source evidence, model/version, prompt/schema version, decision, reviewer/gate, commit/run IDs, output hash, publication status, and follow-up outcome.
- Roll back or quarantine a mechanism when it causes false claims, privacy issues, repeated errors, negative margin, or low-quality artifacts.

## Scoreboard fields
verified_external_revenue_nzd; settled_external_payments; independent_external_buyers; paid_fulfilled_orders; delivery_receipts; qualified_buyer_signals; signal_to_offer_rate; offer_to_paid_rate; time_to_settlement; time_to_fulfillment; gross_margin; contribution_margin_after_compute; refunds/disputes; indexed_artifact_rate; qualified organic visits; cost per experiment; kill/promote reason.

## Current truth boundary
Verified external revenue: NZ$0.00 until a real external buyer's payment is settled and the purchased deliverable is completed with evidence. This file is a planning artifact and is not proof that the workflow ran, the website deployed, a buyer exists, or money was received.
