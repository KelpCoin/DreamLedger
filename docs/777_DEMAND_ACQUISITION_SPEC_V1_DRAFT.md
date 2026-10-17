# 777 Demand Acquisition Specification v1
**Status:** DRAFT / NOT CANONICAL  
**Purpose:** Turn existing free utility surfaces and the AgentBridge execution substrate into a measurable path to the first ten independent buyers, without pretending that content, workflow success, or candidate generation is revenue.

## 1. Non-negotiable truth boundary
- Verified external revenue remains NZ$0.00 until an independent buyer's settled payment is reconciled with the offer, authorized fulfillment, delivery evidence, and outcome.
- A workflow run, page, view, checkout start, quote upload, reply, or unsigned receipt is not a sale.
- Keep listed, claimed, tested, observed, and independently verified evidence separate.
- No paid infrastructure spend, cold bulk outreach, public posting, or GPU exposure without the applicable authority and security gate.

## 2. First wedge: free procurement intake → Truth Oracle
**Entry point:** supplier-quote intake and comparison is free, not a NZ$49 paywall.
1. Accept quote files or structured rows with a clear consent choice.
2. Keep raw files, buyer identity, supplier identity, and private terms in private storage.
3. Extract item, specification, quantity, unit, currency, quoted price, tax/freight/fees, lead time, MOQ, payment terms, exclusions, source date, and extraction confidence.
4. Return an immediate private comparison: normalized unit prices, missing cost fields, delivery trade-offs, and outliers. Mark missing fields unknown, not zero.
5. Only if the submitter explicitly opts in, publish sanitized derived observations to the existing Truth Oracle observation sink. Never publish raw quote files, supplier identities, buyer details, or contract terms.
6. Label source evidence as QUOTED_OFFER / OBSERVED. It is not a settled transaction or a verified market-wide price. Deduplicate by evidence hash and preserve freshness/provenance.
7. If database or parser is unavailable, show an honest retry/private-only state; do not claim an Oracle write occurred.

## 3. Ten-buyer acquisition experiment
This is a staged experiment, not a claim that buyers have already been contacted.
- Segment A: procurement teams and small importers who compare at least two supplier quotes.
- Segment B: trades, repair, and facilities businesses buying repeatable materials or components.
- Segment C: independent purchasing consultants and bookkeepers who already handle quote packs.
- Segment D: marketplace sellers and small manufacturers with repeated sourcing needs.
- Segment E: agent builders needing normalized offer data through an API.

### Acquisition loop
1. Build a sourced prospect set from public business directories, procurement communities, inbound search queries, and opt-in partner referrals. Record source, fit reason, date, and contact permission.
2. Publish one genuinely useful page per distinct problem, backed by primary sources and a working tool. No mass thin pages or fabricated statistics.
3. Offer the free comparison first. Ask one measurable question: did it find a cost difference or missing term that changed a decision?
4. Use opt-in replies, partner introductions, and community-permitted posts. No scraped personal emails, deceptive personalization, automated unsolicited bulk messages, or claims of savings without evidence.
5. With explicit authorization, send small, individually relevant batches. Stop on opt-out, complaint, or no-permission signals.
6. Record the funnel: eligible visits → completed intake → useful report → explicit follow-up request → qualified opportunity → checkout → settled payment → fulfillment → verified outcome.
7. After each cohort, keep, revise, or kill the channel using measured conversion and support burden. Do not scale on impressions alone.

## 4. Monetization: charge for the next job, not for basic truth
- Free: quote intake, basic normalization, private comparison, public Truth Oracle basics, and user-controlled consent for anonymized observations.
- Low-cost A2A: metered structured extraction, comparison API, signed provenance receipts, and agent-compatible schemas. Publish clear limits and deterministic error responses.
- B2B paid: batch processing, private workspaces, integrations, retention controls, audit exports, and service guarantees only where implemented and tested.
- Gauntlet-as-a-Service: charge for reproducible validation runs and evidence bundles, never for a green result.
- Marketplace / commerce rails: monetize completed, authorized transactions via disclosed fees; do not charge a toll before the surface provides real value.
- Never monetize or expose private supplier documents as a hidden data asset.

## 5. AgentBridge and long-running work
Create large, resumable tasks with explicit acceptance criteria and small bounded atoms. Reuse the existing AgentBridge job path and existing queue; do not add a parallel orchestrator.
- Atom A: quote intake contract audit and privacy tests.
- Atom B: parser fixtures for PDF/CSV/text, with confidence and unknown-field handling.
- Atom C: Oracle observation adapter using the existing public observation schema.
- Atom D: free-intake end-to-end smoke test, including consent-on and consent-off cases.
- Atom E: first-party-source research pages with citations and canonical URLs.
- Atom F: prospect-source discovery and opt-in acquisition experiment instrumentation.
- Atom G: A2A offer/receipt compatibility and replay/idempotency tests.
- Atom H: GPU worker feasibility benchmark and sandbox threat model.
Each atom must persist artifact, source evidence, test result, next action, and blockers. Retry safely; never fabricate a completed artifact when the worker or DB is unavailable.

## 6. GPU capacity: opt-in compute, never an open hole
Do not expose the desktop GPU as an unrestricted remote shell or public inbound service.
- First measure idle/available VRAM, thermal/power limits, queue latency, and local workload impact.
- Use outbound-only worker polling, isolated containers/processes, per-job resource caps, strict input/output size limits, no host filesystem by default, no arbitrary code execution, and no secrets in job payloads.
- Start with low-risk, deterministic tasks: document normalization, embeddings, classification, local inference benchmarks, and synthetic evaluation.
- Require explicit opt-in before third-party workloads, data retention, model licensing changes, or external network access.
- Meter completed work and report actual resource usage. Revenue is zero until a real buyer pays and the job is fulfilled.
- If the PC is offline, cloud fallback must use already-authorized free/available capacity only. No paid cloud fallback without an explicit budget authority.

## 7. Compounding website rules
- Publish under a distinct /observatory/ path, separate from product/checkout routes.
- Every page must answer a distinct query, cite primary sources, state observation date, distinguish fact from claim, and link to the useful tool or relevant evidence.
- Do not enforce a fixed word count as a proxy for quality. A shorter page with unique sourced evidence beats 1,000 words of filler.
- Release small cohorts. Measure indexation, useful engagement, qualified requests, and conversion. Consolidate pages that duplicate intent or provide no incremental value.
- Internal links must connect genuinely related entities and evidence, not be generated solely to inflate link density.

## 8. Authority gates
Human authorization remains required for identity, consent, payments, account access, irreversible external actions, public use of private data, and enabling third-party GPU workloads. Routine extraction, linting, retries, scoring, draft creation, and evidence packaging should run without interrupting the owner.

## 9. Acceptance criteria
- Free quote intake does not require a Stripe checkout session.
- Consent-off submission creates no public Oracle observation.
- Consent-on submission publishes only sanitized normalized observations, labelled as quoted offers, with provenance/hash and freshness.
- Raw documents remain private and cannot be fetched anonymously.
- Smoke test verifies real HTTP status and response schema against the deployed service, not just static files or mocks.
- Every public artifact has source URLs and a content hash; stale or contradicted claims are flagged.
- Funnel metrics are sourced from actual events; no synthetic visitors or fabricated buyer counts.
- Existing 777 jobs remain the execution substrate; no second queue/orchestrator/ledger is introduced.
- All production claims are backed by observed deployment and end-to-end evidence.

## 10. First-dollar decision rule
The next priority is not more vertical brainstorming. It is to make the free quote-intake path genuinely work, then measure whether real users complete it and explicitly request a next step. Only after the intake passes privacy and end-to-end tests should the system spend effort scaling pages or acquisition. The first independent paid transaction is the economic proof point.
