# Agent Bridge: 777 inbound seller pilot

## Goal

Turn the existing Agent Bridge into a small, measurable seller agent. The first experiment is one service, one lawful marketplace listing, one bounded deliverable, and one independently settled payment. No DMs, scraping behind login, browser-control bypass, or automated community posting.

## First marketplace candidate: NEAR AI Agent Market

Official entry point: https://market.near.ai/
Agent instructions advertised by the marketplace: https://market.near.ai/skill/SKILL.md
Official launch description: https://near.ai/blog/introducing-near-ai-agent-market

The marketplace says agents can be hired for digital work, submit bids, and get paid through its marketplace. It is a candidate seller surface, not yet a verified payout path for this DreamLedger account. Before a live bid/listing, follow the current skill and terms, confirm seller onboarding, permitted automation, accepted payment asset, fee/dispute rules, and that the selected task is within a deliverable we can actually fulfill.

## Pilot offer

**Title:** Supplier Quote Normalization Pack
**Price hypothesis:** NZ$5 for a small sample; NZ$49 for 2–5 supplier quotes.
**Deliverable:** CSV + JSON comparison with supplier, currency, quoted amount, freight/tax/other cost, MOQ, lead time, payment terms, missing-data flags, and source references.
**Scope:** Deterministic normalization and arithmetic. No claim that a supplier is reputable, that a quote is authentic, or that the cheapest supplier is the best supplier.
**Input boundary:** Customer supplies the quotes and authorizes processing. Redact personal or confidential information not required for the comparison.
**Kill condition:** Stop or revise after 10 relevant marketplace opportunities without an eligible bid, after 3 bids without a funded/accepted task, or immediately if marketplace terms prohibit the intended automation or delivery path.

The NZ$5 and NZ$49 prices are experiments, not observed market-clearing prices. The NZ$49 version matches the existing QUOTE-COMPARE-49 offer concept but is not asserted to be live or checkout-ready here.

## Inbound signal loop using existing substrate

1. Read permitted public job feeds or marketplace APIs only; preserve source URL, observed timestamp, content hash, source identity, and terms/contactability decision.
2. Normalize and score pain with the existing demand graph and CUBE refinery job lane. Deduplicate repeated posts by source and text similarity.
3. Match only to an existing offer and supported capability. If no offer matches, keep the candidate in research; do not invent a SKU.
4. Produce a proposal draft with deliverable, price, exclusions, deadline, source evidence, and confidence explanation. Low confidence or missing scope means HOLD.
5. Route the draft through the existing Gauntlet and human approval gate. Marketplace submissions are external actions; do not submit them merely because a model scored them highly.
6. After an approved submission, record the actual platform receipt/status. A draft is not a submission, a bid is not a buyer, an accepted job is not a payment, and a payment is not a verified outcome.
7. On paid work, use the existing commerce rail and fulfillment contract. Reconcile settlement, attribution, delivery, and independent proof before changing the economic scoreboard.

## RentAHuman classification

RentAHuman is primarily an agent-to-human procurement channel: the agent posts and funds tasks to hire people. It is not a seller-acquisition channel for earning from our own digital services. Its official agent onboarding describes API-key setup and optional x402 signup costing US$10 in spendable USDC. Exclude it from the zero-spend seller pilot; revisit only if a revenue-backed need for human work emerges.

## Agent Bridge toll-road monetization

The separate API revenue track remains:

- Free discovery: public offers, manifests, and machine-readable contracts.
- NZ$1 one-call probe.
- NZ$2 for 200 micro-ingest events.
- NZ$5 for 500 Agent Bridge events.
- NZ$9 for 5,000 shared-route calls / 30 days.
- Higher tiers only when their actual route, quota enforcement, and fulfillment are proven.

All prices are hypotheses until live readiness and a real end-to-end payment test pass. A source-code route, checkout URL, queued CI run, or signed artifact alone is not evidence of a functioning commercial service.

## Acceptance gates before live submission or sale

- Current marketplace instructions and terms read; seller account and payout method verified.
- Supported deliverable exercised end-to-end on sample inputs with deterministic tests.
- Proposal claims match actual capabilities and price; no fabricated performance statistics.
- Any public listing or bid passes the existing human authorization gate.
- Toll manifest reports durable metering READY; quota RPCs and idempotency behavior pass live acceptance tests.
- Stripe settlement, entitlement, API response, delivery artifact, and independent proof can be reconciled.
- Economic scoreboard remains NZ$0.00 until the complete independent-buyer chain is verified.
