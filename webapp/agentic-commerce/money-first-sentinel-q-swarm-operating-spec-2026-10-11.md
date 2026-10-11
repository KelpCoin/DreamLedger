# Money-First Sentinel Swarm: Demand → Intent → Offer → Payment

Date: 2026-10-11
Repository: KelpCoin/DreamLedger
Status: Operating specification / not yet deployed
Verified external revenue: NZ$0.00

## Operating rule
Chase evidence of willingness to pay, not noise, page counts, speculative market size, or engagement alone. A signal is not demand until it contains a specific problem, an identifiable buyer class, a plausible budget or price anchor, a buying trigger, and a reachable lawful purchase path. Strongest evidence is an explicit request for a quote, purchase intent, budget, procurement notice, paid pilot, or repeated costly workaround.

## 1. Signal pipeline
WORLD SOURCES → SENTINEL CAPTURE → IMMUTABLE RAW EVENT → NORMALISE/DEDUPLICATE → BUYING-INTENT SCORE → AMBER ROOM → CUBE 5–10 TEST CELLS → Q-SWARM VARIANTS → ELOHIM SYNTHESIS → GAUNTLET → APPROVED OFFER → EXISTING CHECKOUT → SETTLEMENT → FULFILLMENT → RECEIPT → REPLICATION.

Keep raw observations append-only. AI may classify, cluster, redact, expire, merge duplicates, and propose deletion, but it must not silently erase original evidence or rewrite payment truth. Preserve provenance, observed_at, source URL/ID, content hash, signal type, buyer/problem segment, urgency, price/budget evidence, confidence, freshness/expiry, licensing/privacy status, and reviewer/action lineage.

## 2. The Amber Room: evidence threshold
Amber Room is a review queue, not a new database or a claim of validation. Promote a signal only when it has:
- A concrete painful problem and buyer role.
- Evidence of intent to pay, a budget/price anchor, or a procurement/quote event.
- A credible reachable acquisition surface without personal outreach or paid ads.
- A deliverable outcome using existing capability/assets.
- Positive estimated contribution margin, including model/GPU/API costs and payment fees.
- A safe, lawful data/source basis and a measurable proof-of-delivery plan.

Score candidates on observed buying intent (30%), urgency/cost of inaction (20%), reachability (15%), ability to deliver now (15%), contribution margin (10%), repeat frequency (5%), and evidence quality/freshness (5%). These are triage weights, not empirical probabilities. Hard vetoes: no source provenance, no buyer/problem specificity, unsafe or unauthorized data, unclear payment destination, unavailable authoritative payment ledger, or negative/unknown unit economics.

## 3. Sentinel classes
A. Direct intent: requests for quotes, purchase-ready searches, procurement/tender opportunities, explicit budget, comparison requests with a buying deadline.
B. Costly friction: recurring manual work, failed integrations, compliance discrepancies, document reconciliation, reliability failures with an accountable buyer.
C. Trigger events: regulation/deadlines, supplier changes, contract renewals, system outages, funding/procurement announcements.
D. Platform/API demand: repeated agent requests for a specific capability, rate-limit failures, missing integrations, stable high-frequency tasks.
E. Asset/attention demand: authorized DOOH inventory and proof-of-play requirements; template/stencil demand evidenced by specific use cases, not generic traffic.
F. GPU demand: workload requests with defined input/output, runtime, memory profile, budget, and permitted data. Never expose a workstation or unrestricted shell/network/filesystem access.

## 4. Q-Swarm expansion without runaway cost
For each qualified problem, create 5–10 bounded cells that vary one factor at a time: buyer segment, trigger, offer framing, deliverable, price point, channel, or fulfillment method. Use free/zero-cost discovery first; reuse existing offers and infrastructure. Each cell must specify a hypothesis, evidence source, test ceiling, stop condition, success metric, and kill reason. Run cheap offline evaluation before any cloud/model call. Route easy classification to small local models; use larger models only for finalists. Deduplicate before expensive synthesis. Set hard per-cell token, API, GPU-time, concurrency, and retry budgets. No paid campaign, public posting, purchase, or irreversible action without required authorization.

## 5. Money-first offer ladder
1. First cash: sell an existing, deliverable diagnostic or comparison offer to a buyer already expressing relevant intent.
2. Repeat cash: productize the workflow that fulfils the diagnostic and make turnaround, inputs, exclusions, and evidence explicit.
3. Recurring cash: offer bounded Agent Bridge calls for one proven capability, with authentication, quota, idempotency, timeout, cost telemetry, and receipts.
4. Reusable capital: turn verified delivery components into licensed templates, adapters, schemas, stencils, word banks, and workflow packs.
5. Scale: add adjacent verticals, authorized DOOH inventory, and opt-in isolated GPU jobs only after positive unit economics and a successful delivery path.

Prefer free B2B discovery and cheap A2A execution. No new SKU until existing offer and checkout are reconciled. Price hypotheses are experiments, not forecasts: test existing catalog prices first; consider a low-friction paid diagnostic, then a higher-value implementation or recurring API tier only when the result supports it. Do not promise income frequency or amount without observed buyer data.

## 6. Required event record
signal_id; source; source_url_or_id; observed_at; captured_at; content_hash; raw_evidence_pointer; buyer_role; problem; buying_trigger; intent_evidence; budget_or_price_anchor; estimated_frequency; current_workaround; proposed_deliverable; acquisition_surface; offer_id/version; checkout_destination; estimated_variable_cost; payment_fee_estimate; contribution_margin_estimate; privacy/license review; confidence; freshness/expiry; dedupe_cluster; status; reviewer; decision_reason; experiment_id; external_result; settled_payment_reference; fulfillment_reference; receipt_hash.

Never store credentials or unnecessary personal data. Keep payment evidence restricted. Unknown is not pass.

## 7. Lifecycle and cleanup
CAPTURED → NORMALISED → DEDUPED → SCORED → AMBER_REVIEW → TEST_CELL → OFFER_READY → BUYER_INTENT → CHECKOUT → SETTLED → FULFILLED → VERIFIED → REPLICABLE.
Alternates: STALE, DUPLICATE, UNVERIFIED, CONTRADICTED, BLOCKED, REJECTED, EXPIRED. AI can recommend a transition; preserve prior state and reason. Keep a retention policy for raw data, respecting source terms and privacy requirements. Never turn a speculative signal into a public factual page. Public observatory pages require unique utility, citations/provenance, canonical/duplicate checks, human/publication authorization where applicable, and deployment proof.

## 8. Scoreboard and cadence
Daily: new high-intent signals, qualified Amber Room entries, test cells launched, buyer replies/actions, checkouts, settled payments, successful fulfillments, refunds/chargebacks, and contribution margin.
Weekly: precision of qualified signals, cost per verified buyer, intent-to-payment conversion, time-to-delivery, repeat purchase, stale/duplicate ratio, and percentage of pages/API calls producing measurable value.
Primary objective: maximize verified contribution dollars per unit of human attention and compute. Secondary objective: increase repeat purchase frequency. Stop any cell after its budget is exhausted without new evidence; replicate only verified mechanisms.

## Current blockers
- Fresh 777 artifact/run proof must be inspected by run ID; a green workflow alone is insufficient.
- Existing Agent Bridge cloud runtime is blocked; previous adapter fell back deterministically and Gauntlet failed.
- Supabase data-plane is not trusted until recovery and SQL probe succeed; do not claim atomic authoritative quota or write payment truth there while unavailable.
- No verified external revenue yet. Do not report forecasts as earnings.

## Acceptance for the next 777 expedition
1. Capture a new run ID, event, commit SHA, job/step conclusions.
2. Produce a run-scoped artifact or explicit no-new-artifact receipt with hashes.
3. Select the highest-evidence existing offer, not the largest speculative market.
4. Prove the full path: buyer intent → existing checkout → settled external payment → authorized execution → delivered result → evidence receipt.
5. Only then replicate the successful offer, page, API capability, or Q-Swarm cell.
