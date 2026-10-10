# Pattern Overlay Audit: successful patterns to splice into DreamLedger, and failure modes to invert

**Date:** 2026-10-10  
**Status:** research-backed design audit; not a claim that integrations are implemented or checkout is fixed.

## Executive decision

Do not replace DreamLedger with a new architecture. Add a thin Pattern Overlay around the existing substrate:

1. Existing source-of-truth and authorization boundaries remain canonical.
2. New capabilities register through a versioned manifest/adapter.
3. External actions pass the existing fulfillment gates.
4. Adapters emit normalized evidence events, never self-certified revenue.
5. The Gauntlet runs tests and counterexamples before promotion.
6. Only demonstrated improvements get merged or exposed publicly.

The overlay is a compatibility layer, not a second truth system. Keep the first commercial gate on the existing Agent Bridge TOLL-PROBE-50C route. Do not create new tolls until the route can reconcile settlement → scoped entitlement → successful result → receipt.

## Patterns worth copying

### 1. Stripe agentic commerce: normalize once, distribute through adapters

Stripe reports that catalog syndication across agent interfaces creates maintenance burden when every destination requires a different format. Its ACP work focuses on a shared checkout contract and transaction lifecycle.

**Splice:** one canonical CapabilityManifest and Offer model; adapters transform the same validated record into HTML, machine-readable JSON, MCP/A2A descriptors, RFQ feeds, and future partner formats. Preserve version, price, currency, availability timestamp, source, and fulfillment contract.

**Invert:** a catalog listing is not demand and not a settled sale.

Source: https://stripe.com/blog/10-lessons

### 2. Marketplace rails: reuse regulated payment/payout primitives

Stripe Connect provides seller onboarding, verification, split charges/payouts, refunds, disputes, and reconciliation. Stripe warns that accepting funds for other parties outside an appropriate marketplace model can create aggregation/terms problems.

**Splice:** DreamLedger owns discovery, comparison, matching, evidence, and customer experience. Use a supported payment/payout model appropriate to the seller-of-record arrangement. Do not build custody, seller payouts, or DIY KYC into the first version.

**Invert:** never route third-party seller funds through DreamLedger as though it were an ordinary single-merchant sale. Confirm seller of record, refund/dispute responsibility, and platform eligibility before multi-vendor settlement.

Sources:
- https://stripe.com/connect/marketplaces
- https://support.stripe.com/questions/restrictions-for-marketplaces-not-using-stripe-connect

### 3. AWS reliability: timeouts, bounded retries, backoff, idempotency, fail fast

Retries can magnify outages or duplicate side effects if operations are not idempotent. AWS recommends timeouts, retries and backoff, with idempotent operations; non-transient errors should fail fast.

**Splice:** a shared outbound-action wrapper for external APIs and agent jobs: timeout → classify transient/permanent error → bounded exponential backoff with jitter → idempotency key → circuit breaker → evidence receipt. Retry reads safely; never blindly retry a charge, order, payout, or irreversible action.

**Invert:** no infinite retries, retry storms, duplicate fulfillment, or false success when the provider response is ambiguous.

Source: https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html

### 4. GitHub Actions: stagger schedules, but design for dropped/replaced runs

GitHub documents scheduled-run delays/drops under high load and concurrency behavior that can replace older pending runs in a group.

**Splice:** keep off-minute scheduling, workflow_dispatch, explicit run IDs, artifact receipts, watermarks, and per-boundary diagnostics. Use unique concurrency groups only when concurrent runs are safe; otherwise use queue/serialization that matches the job's state semantics.

**Invert:** cron is not a durable queue. Each expedition must be restartable, deduplicated, observable, and safe when a run arrives late or twice.

Sources:
- https://docs.github.com/en/actions/how-tos/troubleshoot-workflows
- https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows

### 5. x402 research: transaction count is not adoption

A 2026 population-scale study argues that x402 settlement counts can be manufactured or dominated by internal linked clusters; raw transaction volume does not prove independent customer demand. A separate security study identifies replay/context-binding, concurrency, and authorization-state risks in pay-per-call designs.

**Splice:** track payer independence, payer/provider linkage, unique customer identity where lawfully available, actual service delivery, net settled value, and repeat use. Bind payment proof to exact resource, price, currency, expiry, and request; atomically consume entitlement/quota and make replay harmless.

**Invert:** no vanity metrics, self-purchase loops, subsidized spam presented as demand, cross-resource proof reuse, race-condition double service, or compute-cost leakage.

Sources:
- https://arxiv.org/abs/2607.12575
- https://arxiv.org/abs/2605.30998

### 6. Google Search: content quantity is not a compounding asset by itself

Google classifies scaled production of unoriginal pages primarily intended to manipulate rankings as scaled-content abuse, including AI-generated pages with little added value. There is no magic minimum word count that guarantees rankings.

**Splice:** publish only when a page contains a user-useful original tool, sourced dataset, verified change, comparison, downloadable artifact, or reproducible calculation. Prefer fewer pages with unique utility, source provenance, update history, and a relevant next action.

**Invert:** do not make a 600–1,200-word threshold the goal, mass-generate near-duplicate pages, or treat indexation as proof of commercial value.

Sources:
- https://developers.google.com/search/docs/essentials/spam-policies
- https://developers.google.com/search/docs/fundamentals/creating-helpful-content

## Local substrate audit

### Existing strengths to preserve

- docs/FORENSIC-FULFILLMENT-ACCEPTANCE.md separates observed opportunity, real demand, capability, data, access, authority, executable workflow, validation, delivery, and external action.
- docs/B2B-MARKETPLACE-TRANSACTION-OS.md defines a reusable transaction kernel and says the 400-pain corpus must not become 400 checkout pages.
- .github/workflows/777-cycle.yml already uses off-minute scheduling, manual dispatch, run-specific concurrency groups, and a compounding gate.
- README.md names TOLL-PROBE-50C as the small machine-payment experiment and separates checkout activity from verified revenue.
- docs/777/PATTERN-FOUNDRY.md defines original pattern extraction and specialist-agent review.

### Concrete risks found

1. **Conflicting first-wedge references.** README.md names TOLL-PROBE-50C as the live machine-payment test, while docs/B2B-MARKETPLACE-TRANSACTION-OS.md calls QUOTE-COMPARE-49 the first public transaction-service wedge. These are different experiments with different fulfillment dependencies. Declare one canonical first-dollar path; mark the other blocked/quarantined until its own fulfillment contract passes.
2. **Known checkout failure.** The last recorded live diagnostic returned HTTP 503 for the toll-road checkout. A healthy manifest or checkout_configured flag does not override a failing checkout response. Recheck the current endpoint before any sale-ready claim.
3. **Silent exception handling in scripts/777_compounding_gate.py.** The no-op receipt block reads os.environ but the inspected file does not import os; broad exception handling catches the resulting NameError and converts it into valid_noop = False. This masks a coding defect as a missing receipt and can make a legitimate no-op cycle fail. Add import os and a regression test for current-run no-op receipt handling.
4. **Artifact existence is weaker than artifact quality.** The inspected gate accepts changed public HTML paths or catalogue JSON, but does not establish page-specific source quality, unique utility, provenance, duplicate/cannibalization checks, or external deployment success. Add these checks before treating generated pages as compounding assets.
5. **CI green is not deployed parity.** README.md says production serves compiled artifacts from BEC-PRIME/compiled/website. A source/generator change must be compiled, deployed, and smoke-tested on the public URL.
6. **Database durability is a separate boundary.** While Supabase is unavailable, durable entitlement, atomic quota consumption, and DB-backed evidence cannot be presumed healthy. Do not quietly replace them with in-memory state and call it production-ready.

## Overlay contract

Every adapter/agent emits:
- pattern_id, source_refs, license_constraints, version
- input_schema, output_schema, capabilities, limitations
- price, currency, availability_observed_at, fulfillment_contract
- authorization_scope, idempotency_key, trace_id, expiry
- tests_passed, tests_failed, unknowns, evidence_refs
- external_outcome_status, payment_status, delivery_status, truth_status

Promotion gates:
1. Schema compatibility.
2. Provenance/license checks.
3. Security and secret scan.
4. Unit, contract, and integration tests.
5. Replay, race, retry, and failure-injection tests.
6. Build plus production URL smoke test.
7. Fulfillment acceptance contract.
8. Independent economic evidence before any revenue claim.

## Priority sequence

**P0:** revalidate the 503 toll-road checkout and identify the first failing boundary; fix the no-op gate import and regression test; resolve canonical first-wedge conflict.  
**P1:** implement shared manifest/offer schema and adapter contract.  
**P1:** add replay/context-binding/idempotency/quota-concurrency tests.  
**P2:** add content provenance/uniqueness/utility gate and production-parity smoke test.  
**P3:** only then add seller payouts, DOOH inventory, or public GPU jobs. Public GPU exposure remains disabled until sandboxing, egress controls, budgets, secret isolation, cancellation, and kill-switch tests pass.

## Scoreboard

Verified external revenue: **NZ$0.00** unless independent settlement, attribution, fulfillment, delivery evidence, and reconciliation prove otherwise. This audit identifies reusable patterns and source-level risks; it does not certify fixes as deployed or the existing checkout as working.
