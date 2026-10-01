# DREAMLEDGER BUILD EVERYTHING DIRECTIVE
## 2026-10-02

MISSION: Build the existing DreamLedger substrate into a continuously operating economic engine that discovers, stress-tests, sells, fulfills, verifies, and learns from real economic opportunities with minimum recurring human attention.

TRUTH CHAIN:
REAL DEMAND -> REAL BUYER -> AUTHORIZED ACTION -> EXTERNAL RESULT -> SETTLED PAYMENT -> FULFILLMENT -> DELIVERY/EVIDENCE -> VERIFICATION -> VERIFIED ECONOMIC OUTCOME

Current scoreboard remains NZ$0.00 verified external revenue, 0 settled external payments, 0 independent external buyers, 0 verified economic outcomes.

BUILD LOOP:
CUBE -> SWARM -> ELOHIM -> GAUNTLET -> COMMERCIAL CELL -> FREE UTILITY / PAID DEPTH -> PAYMENT ENTITLEMENT -> AUTOMATED FULFILLMENT -> EVIDENCE -> TRUTH ORACLE -> LEARNING

COMMERCIAL SURFACES:
1. GAUNTLET-AS-A-SERVICE: authorized adversarial testing.
2. TRUTH-AS-A-SERVICE: evidence-oriented verification, never manufactured certainty.
3. BILLBOARD / QR.
4. PROGRAMMATIC DOOH.
5. AT-HOME ADVERTISING.
6. CRYPTO MARKET INTELLIGENCE / LAWFUL ARBITRAGE RESEARCH.
7. TCG / MTG MARKET INTELLIGENCE / ARBITRAGE RESEARCH.

FIRST CANDIDATE QUEUE:
EDH Micro-Audit / Commander Diagnostic; NZ RDTI Evidence Pack; MTG Local-vs-Online Price Comparison; Procurement Spreadsheet Normalization / Quote Compare; Contractor Rate & Tax Compliance Audit.

REUSE THE EXISTING SUBSTRATE. Do not create a second ledger, payment vocabulary, Truth Oracle, commerce queue, swarm, or silo framework.

PAYMENT ENGINE:
Trace the deployed Stripe webhook, migrations, RPCs and consumers. Commerce must consume stripe_webhook_events, not economic_model_tasks. Implement durable PENDING -> PROCESSING -> COMPLETED state, lease-token guarded completion, expiry recovery, idempotency, and durable writes before COMPLETED. Never delete deduplication rows after failure. Test duplicates, concurrency, failure after proof/order creation, lease expiry/recovery, malformed events, entitlement mismatch, and unsettled payments. Never claim a test passed without actual run evidence.

TOLL ROAD:
Preserve signed scoped keys, live settlement requirement, scope separation, fail-closed secrets, and no internal rail exposure. Inspect/repair persistent entitlement, metering, decrementing calls, revocation, expiry, line-item attribution, idempotent redemption and replay protection. Never invent Stripe prices. Missing dedicated price = explicit configuration blocker.

FIVE-FALLBACK RULE:
For every material subsystem, define and test five fallback paths.
Demand: CUBE signals -> public structured data -> search evidence -> existing commercial surfaces -> manual candidate input.
Model: LM Studio -> cloud model/runtime -> deterministic rules/templates -> cached validated artifact -> human-gated manual artifact.
Fulfillment: automated fulfillment -> deterministic generator -> queued fulfillment -> manual gate -> REFUSED/REFUND/UNVERIFIED.
Payment evidence: live Stripe settlement -> Stripe reconciliation -> independent payment evidence -> manual review -> UNMATCHED/UNVERIFIED.
External action: authorized automation -> authorized browser/API -> prepared human-gated action -> queue -> REFUSED.
Deployment: normal CI/CD -> rollback -> staged deploy -> local verification -> no-deploy proof.
Database: canonical table/function -> additive migration -> compatible adapter/view -> local projection -> read-only degraded mode.
Truth: authoritative evidence -> independent corroboration -> deterministic verification -> manual review -> UNVERIFIED.

FAIL CLOSED. If all fallbacks fail, emit BLOCKED_BY_SUBSTRATE, BLOCKED_BY_HUMAN_AUTHORITY, BLOCKED_BY_EXTERNAL_EVENT, or UNVERIFIED. Never fabricate success.

BUILD ORDER:
1 inventory repo/runtime;
2 trace payment/webhook path;
3 trace economic task path separately;
4 inspect live schema/consumers;
5 durable commerce inbox;
6 commerce worker;
7 reusable commercial-cell template;
8 convert CMD diagnostic machinery into reusable candidate-cell pattern;
9 repair Toll Road entitlement wall;
10 Gauntlet service cell;
11 Truth service cell without replacing authoritative Truth Oracle;
12 adapters for remaining commercial surfaces;
13 evidence/proof artifacts;
14 daily candidate tournament;
15 fallback routing;
16 tests;
17 record exact commands/output/SHAs;
18 stop only at a genuine external/human blocker or verified economic outcome.

DAILY TOURNAMENT:
Refresh demand, generate candidates, score evidence/margin/automation/fulfillment/authorization, attack candidates, kill weak candidates, package survivors, expose free utility, expose paid depth, measure external events, preserve only verified economic learning, and reset disposable hypotheses.

LM STUDIO MAY inspect, code, refactor, test, analyze, generate candidates, adversarially review and prepare commits. It is NOT payment authority, settlement authority, Truth Oracle, buyer, customer, or authorization substitute.

CLOUD AUTHORITY:
GitHub = source control; Render = runtime/deployment; Supabase = canonical state; Stripe = settlement authority; Truth Oracle = evidence boundary; DreamLedger public surfaces = figurehead.

PROOF STANDARD:
INSPECT -> CHANGE -> VERIFY -> PROOF.
Record changed files, tests and real outputs/run IDs, commit SHA, deployment ID only if actually deployed, remaining blocker, and economic-state impact.

NEVER: simulated payment = revenue; internal buyer = customer; checkout = sale; webhook fixture = settlement; generated report = paid fulfillment; deployment success = economic success.

COMPLETION:
Do not stop because architecture exists. Stop only when the next step genuinely requires a real external economic event, a necessary human authority gate, a verified economic outcome, or a documented blocker after five fallback attempts.

PRIMARY OUTCOME:
Build a machine with a measurable, repeatable path toward real revenue. Do not promise wealth. Make the path to wealth testable.