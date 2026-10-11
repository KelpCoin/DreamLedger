# 777 Agent Bridge: First-Dollar Execution Contract
Date: 2026-10-11
Repository: https://github.com/KelpCoin/DreamLedger
Status: IMPLEMENTATION PLAN / NOT YET EXECUTED
Revenue truth: NZ$0.00 verified external revenue.

## Objective
Turn the existing Agent Bridge catalogue into one provable paid service path without creating a new SKU or parallel ledger:
discovery -> existing offer -> Stripe checkout -> verified settlement -> scoped entitlement -> authenticated bounded call -> delivered result -> evidence receipt -> reconciliation.

## Current evidence and blockers
- The latest run inspected in this expedition was GitHub run 38016782578. Its `pulse` job completed successfully and its job steps include Agent Bridge catalogue sync, economic pulse generation, cloud execution adapter, compounding gate, and commit-if-changed.
- That run has no downloadable Actions artifacts. A green workflow is not proof that a unique page was published, deployed, purchased, or fulfilled.
- Existing Airtable control records identify the Agent Bridge toll contract as BLOCKED_ON_CLOUD_RUNTIME; prior adapter execution used DETERMINISTIC_FALLBACK and the Gauntlet receipt was FAIL.
- Supabase management state and Postgres data-plane access have diverged. Do not write payment truth, run migrations, or claim durable atomic quota until provider recovery and a successful SQL probe.
- Do not start another broad push-trigger storm. A recent control record documents 46 queued workflow runs and 777 itself queued. This change is staged on a dedicated branch; no production workflow was manually dispatched by this action.

## Decomposed work packages
### W0. Obtain a clean 777 execution proof
Acceptance: identify a fresh run ID; confirm event, commit SHA, job conclusion and every step; capture generated files or an explicit run-scoped NO_NEW_ARTIFACT receipt. Never infer output from a green check alone.
Guardrail: use workflow_dispatch or an operator-approved narrow trigger. Do not push a trivial commit to main while the push-trigger storm remains unresolved.

### W1. Select one existing offer
Acceptance: catalogue SKU and current Stripe destination agree on product identity, amount, currency, and fulfillment contract. No new SKU and no test-mode payment counted as revenue.

### W2. Prove checkout attribution
Acceptance: a real successful external payment can be correlated to the intended offer and buyer/order using provider event IDs and idempotency. Checkout creation, PaymentIntent, test transactions, and internal rows are not settled revenue.

### W3. Enforce entitlement and metering
Acceptance: authenticated caller, scoped key, SKU/version, budget/quota cap, expiry/revocation, idempotency, replay protection, atomic quota update, rate limit, timeout, and bounded retries all have tests. If Supabase remains unavailable, keep execution in test mode; do not invent a second source of payment truth.

### W4. Deliver a bounded capability
Acceptance: one Agent Bridge capability returns a deterministic, useful result with input/output schema, error contract, measured latency/cost, and a safe refusal path. No arbitrary shell, filesystem, network, or GPU access.

### W5. Produce a verifiable receipt
Acceptance: receipt binds request ID, offer/version, authorization decision, provider payment/event reference, input/output hashes, result status, timestamps, measured resource cost, and delivery evidence. Secrets and personal data are redacted.

### W6. Measure positive unit economics
Acceptance: record provider/model/GPU cost, retries, payment fees, and successful delivery rate. Enable paid metering only if the observed contribution margin is positive. GPU capacity is opt-in, sandboxed, quota-limited, and never exposed as unrestricted host access.

### W7. Publish one high-value component
Acceptance: unique source/provenance, differentiated utility, canonical URL, clear capability/status, useful example, relevant commercial CTA, internal link, lint/duplicate check, rollback proof, and deployment verification. A draft or branch artifact is not a public page.

### W8. Replicate only after proof
Acceptance: independent buyer, settled payment, successful fulfillment, and delivery evidence. Only then promote the capability, stencil, template, word bank, or neural-network association from STAGED to REUSABLE.

## Marketplace direction
- Free B2B discovery; low-cost A2A for bounded, successful calls.
- Reuse the existing marketplace listing schema, Agent Bridge catalogue, and toll contract. No parallel platform or truth ledger.
- Reusable goods: versioned templates, boilerplates, stencils, word banks, adapters, schemas, and tested workflow components with explicit licenses and provenance.
- DOOH: represent only publisher-authorized inventory and require creative approval plus proof-of-play.
- GPU: offer measured, opt-in jobs in an isolated worker with hard CPU/GPU/memory/time/network limits, quotas, and kill switch. Never expose the owner's workstation or credentials to customers.
- Keep MTG/HappyHomarid/CollectorsCoast fully siloed from Amplissa/adult. No cross-silo data, catalogue, or CTA.

## Stop conditions
Stop and mark BLOCKED if payment destination is ambiguous, the data plane is unavailable, authentication is missing, quota cannot be enforced, provider cost is unknown, output provenance fails, or a required CI/security check is skipped.

## Proof checklist
- [ ] Fresh 777 run inspected by run ID
- [ ] Unique artifact hash and source provenance recorded
- [ ] Target route and deployment independently verified
- [ ] Checkout -> settled payment -> entitlement -> call -> receipt -> fulfillment proven end-to-end
- [ ] Airtable and Notion receipts link to exact repository/run evidence
- [ ] Revenue scoreboard updated only from independently verified settlement
