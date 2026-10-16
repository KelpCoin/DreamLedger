# DreamLedger Defended Limits Register

**Status:** proposed binding operating policy, awaiting CI and review.  
**Scope:** BECK, Figure Eight, Gauntlet, Truth Oracle, economic events, public catalogs, and silo generation.

A defended limit is an intentional exclusion with its reason recorded beside the operating procedure. It is not a TODO. Agents may surface evidence that a limit should change, but cannot change the limit by themselves. Reopening a limit requires a reviewed decision artifact, bounded approval, evidence, and a regression test.

| Process | Defended limit | Why it exists | Evidence required to reopen |
|---|---|---|---|
| Economic verification | A green test, healthy endpoint, click, checkout session, generated product, model assertion, or internal key is never revenue. | Technical activity and economic outcomes are different facts. | Independent buyer, processor settlement, canonical SKU/silo attribution, fulfillment, delivery artifact, independent verification, and reversal reconciliation. |
| Settlement ownership | Exactly one canonical settlement owner writes authoritative settlement and order attribution. | Multiple writers risk duplicate orders and inconsistent reversals. | Reviewed architecture decision, replay/duplicate tests, deployed handler identity, and reconciliation proof. |
| SKU handoff | One canonical SKU survives product → checkout metadata → webhook → order → fulfillment → verification. | Producer/consumer key disagreement silently breaks attribution. | Contract test traces the exact SKU through every consumer, including explicit rejection or adaptation of legacy keys. |
| Secret fallback | Blank and whitespace-only secrets are missing; fallback resolution must reject empty values, not only null/undefined. | Empty strings can shadow a valid fallback while making configuration look present. | Tests for undefined, null, empty, whitespace, malformed and valid values; no secret values in logs. |
| Test/live separation | Test events are TEST/SIMULATED and never enter live verified totals. | Test evidence proves mechanics, not an independent buyer outcome. | This boundary is not relaxed; tests only prove separation. |
| Silo cloning | New clones start with empty catalogs and no inherited supply evidence, stock, capacity, Stripe identifiers, credentials, approvals, orders, or revenue totals. | Code and templates can be inherited; market evidence and authority cannot. | Clean-clone fossil, route isolation tests, empty-catalog assertion, credential scan, and checkout-disabled assertion. |
| Supply publication | Candidate ideas and proposed prices cannot be rendered as verified stock or purchasable offers. | Generation is not supply, rights, buyer demand, or fulfillment capacity. | Current source-linked supply atom, rights/capacity basis, freshness check, and independent Gauntlet decision. |
| Checkout activation | Checkout stays disabled until supply, Gauntlet, activation, authoritative price, fulfillment, and canonical settlement routing gates have evidence for the exact SKU and silo. | A reachable link can collect money for an offer that cannot be delivered or attributed. | Approval fossil plus isolated payment-to-delivery test and deployed-route convergence. |
| Payment fulfillment | Fulfillment requires verified settlement and idempotent entitlement redemption. | Redirects and checkout screens can precede or misrepresent settlement. | Canonical processor event, order attribution, durable quota/entitlement, delivery receipt, replay tests, and reversal tests. |
| Local BECK | Local inference is optional capacity. Cloud truth does not depend on the PC being on. | A powered-off PC cannot execute local work, and local model claims cannot replace economic records. | Resilience test that loses local heartbeat and safely defers or routes work without falsifying state. |
| PC power state | Missing heartbeat means OFFLINE_OR_STALE/UNKNOWN, not proof that the computer is powered off. | Sleep, network failure, task failure, app failure and token/config errors can look identical from cloud. | Independent out-of-band power telemetry. Never infer power state from heartbeat absence alone. |
| Investigation worker | Read-only by default, maximum 15 tool calls, five-minute wall-clock deadline, and fail-closed on unapproved actions or exhausted budget. | Investigation must not quietly become production remediation. | New explicit scope approval, reviewed action allowlist, rollback plan, and independent test. |
| Credentials | Secrets stay in the provider's secret manager or secure local environment; names-only inventory is allowed, secret values are not. | Logs, chat, commits, and browser surfaces are not secret stores. | Rotation and access validation performed directly in the credential provider, with names/timestamps only in evidence. |
| Public publishing | Public pages and machine catalogues are generated from the approved registry; held/test/unverified offers are not advertised as buyable. | Manual copies drift from actual supply, price and fulfillment readiness. | Generated-artifact diff, public route checks, source-SKU match, and live deployment SHA proof. |
| Loop autonomy | Scheduled loops may observe, diagnose, test and propose within explicit budgets. They may not spend, change secrets, deploy to production, activate checkout, or post publicly without the relevant authorization. | Unbounded loops convert mistakes into repeated side effects. | Scoped authorization, cost ceiling, kill switch, evidence of dry-run correctness, and rollback/compensation route. |
| Self-approval | The builder/model cannot be its own final judge. | Reward hacking and self-reported success are not independent verification. | Independent deterministic test or external evidence; no model-only exception. |
| AI contribution transparency | Every customer-facing section records whether it was human-written, AI-assisted, AI-generated, or mixed, with model/tool and contribution details. | Fluency alone cannot establish authorship or the work actually performed. | Reopen only with accurate provenance; a generic or contradictory disclosure stays on HOLD. |
| Human voice | Preserve operator-supplied judgment or experience only with source reference and operator confirmation. Never invent first-person memories, sensory details, customer quotes, or testimonials. | Fabricated authenticity is still fabrication. | A humanization score or detector score is not proof of authorship; the operator must confirm the source and meaning. |
| Humanizer | Clarity edits must preserve meaning and material caveats. AI-detector evasion is never a rewrite objective. | Concealment destroys trust and can erase the operator's actual voice. | Truth-preservation check, fact trail, and operator review; detector-evasion requests are REJECT. |
| Inference spending | Paid cloud/model API spend stays disabled until the operator explicitly approves a source and budget. | Pre-revenue loops must not silently consume funds. | Explicit spend approval, ceiling, kill switch, and accounting record. Current free-tier/model names and terms must be checked at use time. |
| Cognitive offloading | For learning-mode tasks, capture operator prediction and falsification criteria before the agent reveals its diagnosis, then record one skill to practice. | Automating output must not quietly outsource the operator's verification judgment. | The operator may skip learning mode for routine output tasks; it does not block necessary accessibility support. |

## Investigation handoff artifact

Each Stripe/configuration investigation must record, in the same artifact as its verdict:

- Incident ID, exact error signature, observed UTC time, service/function identity, deployed version/commit, and relevant log/source references.
- Names-only secret/configuration inventory: key name, present/absent/empty status, environment/scope, and timestamp. Never include the value or a reversible derivative of it.
- Code-path trace from checkout creation through webhook/settlement attribution to fulfillment and delivery verification.
- Facts, inferences, contradictions, missing evidence, root-cause confidence, and what would falsify the diagnosis.
- Smallest proposed repair, tests required, expected failure modes, rollback/compensation, and the approval that is required before any consequential action.
- **Defended limits:** what was deliberately left unchanged, what was excluded from the repair scope, why each exclusion exists, and what evidence would be required to reconsider it.
- Next owner/action and a concrete verification command or probe.

Reasoning should be recorded as concise, auditable evidence and decisions, not as private hidden chain-of-thought. Tool calls, arguments with sensitive values redacted, sources, timestamps, outcomes, and decision rationale are sufficient.

## Current known constraints

- Render production deploys were reported failing with `pipeline_minutes_exhausted` on 15 October 2026. A code commit on an isolated branch does not fix production availability.
- A Supabase query timed out during the most recent inspection. Do not infer current heartbeat-row state from that timeout.
- The local bootstrap and heartbeat implementation is on an isolated review branch and has not been deployed or run on the actual PC.
- Local heartbeat status is transient operational telemetry, not a durable economic-event record.
- Verified external revenue remains **NZ$0.00** unless the full independent evidence chain is recorded and reconciled.
