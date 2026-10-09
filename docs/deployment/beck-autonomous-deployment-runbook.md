# BECK autonomous deployment runbook: MVP → full system

**Status:** implementation plan with verified repository edits; production deployment and live economic execution remain unverified.  
**Authority:** DreamLedger/KelpCoin repository is canonical for code and tests; Notion records decisions; Airtable is a compact control mirror.  
**Truth boundary:** `VERIFIED_EXTERNAL_REVENUE = NZ$0.00` until an independent buyer, settled payment, fulfillment, and delivery evidence are joined.

## Operating objective

Get the existing BECK / DreamLedger substrate to a safe MVP, then harden it into a cloud-authoritative autonomous system that can continue while the desktop is off. The desktop and LM Studio are optional acceleration, not the control plane. Routine research, code changes, tests, and reversible deployment preparation should proceed without owner input. Human gates remain for identity, consent, external communication, payment, account/domain authority, credential rotation, and irreversible actions.

Do not introduce a second ledger, queue, orchestrator, or truth system. Inspect and reuse the existing production observation contract, probe, event projection, state transition engine, Stripe observation adapter, Agent Bridge, Cloud Elohim/Gauntlet, and current commerce rails.

## Deployment ladder

### Gate 0 — establish an honest baseline

- Record the exact default-branch SHA and the actual service/domain mapping.
- Retrieve workflow run, job, step, artifact, and commit evidence from the same run. A green badge, a commit, a queued run, or a 404 is not proof of a successful runtime.
- Probe the public root, `/trust/`, `/about/`, the new community-input artifact, `/healthz`, `/version`, and the toll manifest.
- Keep separate fields for source committed, workflow executed, artifact generated, artifact deployed, external result observed, and economic outcome verified.

**Exit:** reproducible baseline record with timestamp, URLs, status codes, run IDs, job conclusions, and the truth label for every claim.

### Gate 1 — website MVP

- Publish the evidence-first homepage, About, Trust & Evidence, and useful Observatory pages from the intended static-site service.
- Verify custom-domain ownership and the configured publish directory before changing routing. Do not switch the apex until the target service is positively identified.
- Test mobile layout, keyboard focus, contrast, internal links, page metadata, CSV generation, and no-JavaScript fallbacks.
- Remove or repair stale `$NaN`, empty/loading placeholders, unverified inventory counts, broken trust links, and purchase buttons that imply unavailable inventory.
- Add a sitemap and robots policy only after the actual static-site root and canonical paths are verified.
- Do not invent testimonials, certification marks, inventory, reviews, buyer counts, or guarantees.

**Exit:** external smoke tests pass on the intended domain and every page says accurately what is live versus proposed.

### Gate 2 — BECK evidence MVP

- Reuse `runtime/economic/production_observation_contract.py`, `production_observation_probe.py`, `event_projection.py`, `state_transition_engine.py`, and `stripe_observation_adapter.py`.
- Define a single evidence envelope: event ID, event type, source system, source object ID, observed-at timestamp, idempotency key, prior-event reference/hash, actor/authority scope, artifact hash, truth label, and raw-source reference.
- Enforce append-only behavior and concurrency safety at the database/write boundary. A hash chain without serialized append or a unique predecessor constraint can fork under concurrent writes.
- Treat `DISPATCHED` as distinct from `EXTERNAL_SENT`, `EXTERNAL_RESULT_OBSERVED`, `SETTLED`, `FULFILLED`, and `VERIFIED`.
- Keep test, simulated, internal, unmatched, stale, and contradicted evidence out of the verified economic scoreboard.

**Exit:** adversarial tests demonstrate duplicate delivery is idempotent, concurrent writers cannot fork the canonical chain, stale workers cannot overwrite newer state, and missing causal links fail closed.

### Gate 3 — first real commerce proof

- Test the existing published checkout and fulfillment path with a real independent buyer only when the buyer voluntarily initiates the transaction.
- Link offer ID, expected Price ID/amount/currency, stable buyer reference, Checkout Session, PaymentIntent, settlement observation, entitlement, fulfillment request, delivery ID, and evidence hashes.
- Use server-side price/offer validation and an atomic idempotent transaction + evidence append in the existing schema. Do not infer a sale from a checkout URL or successful test payment.
- Validate Stripe webhook signatures; keep the active v3 endpoint as the candidate source of truth after inspection. Treat the hard-coded secret previously found in the legacy v2 function as exposed and require an authorized rotation and retirement plan before relying on that endpoint.
- Never expose service-role credentials or permit public untrusted sources to write with elevated privileges.
- The database inspection path previously failed on direct IPv6 port 5432. Test the configured Supabase Session Pooler and read-only inspection before any migration. Do not infer that a migration is applied until the schema is read back.

**Exit:** one independently verified buyer journey reaches settled payment, fulfillment, delivery evidence, and a reproducible receipt. Until then, revenue remains zero.

### Gate 4 — cloud-authoritative 24/7 operation

- Run the existing 777 workflows with off-minute schedules, manual dispatch, non-cancelling concurrency for critical work, and overlap/watermark semantics where supported.
- Treat GitHub Actions as a trigger/CI surface, not the sole durable scheduler for critical production work. Evaluate existing Supabase `pg_cron` + `pg_net` + Vault only after DB connectivity and secret handling are proven; write execution status back because `pg_net` dispatch is asynchronous.
- Ensure the cycle discovers and scores real source signals. An empty signal array must never be represented as demand discovery.
- If cloud Elohim/Gauntlet or model routing is unavailable, fail closed or create a clearly labelled internal diagnostic. Never manufacture a candidate, buyer, or external event.
- Add an operator kill switch, health checks, rate limits, retries with bounded backoff, dead-letter visibility using existing primitives, and a daily evidence summary.
- No notifications after 02:00 local time; routine non-urgent work stays staged for the next summary.

**Exit:** measured multi-day operation with recoverable failures, no duplicate external effects, and independently fetched run/job/receipt evidence.

### Gate 5 — Agent Bridge monetization

- Sell one bounded, useful A2A job through existing commerce rails before building a broad marketplace.
- Candidate initial jobs: subtitle/metadata cleanup for rights-cleared media, supplier-quote normalization, catalog attribute enrichment, prompt/asset tagging, or evidence-chain validation.
- Every job includes requester authorization, budget cap, scope, acceptance tests, worker identity, input/output hashes, deadline, cancellation/refund policy, signed handoff receipt, and evaluator-controlled completion.
- Use lease TTL and monotonic fencing tokens enforced at the write boundary. A token merely stored or checked by the client is not enforcement.
- Offer free B2B listings if useful; charge only for a defined valuable action or completed result. Measure real external developer demand and cost before setting a price.
- Keep the ERC-8183-style Open → Funded → Submitted → Terminal lifecycle as an integration concept, not a claim that DreamLedger is already compliant or deployed on-chain.

**Exit:** an external customer pays for a bounded job, the output passes the evaluator, delivery is observed, and the receipt reconciles to the settled payment.

### Gate 6 — GPU and public marketplace scale

- Measure the actual desktop GPU, VRAM, utilization, power, idle windows, and failure rate; do not assume a model or memory capacity.
- Third-party GPU jobs remain blocked until sandboxing, tenant isolation, resource quotas, model allowlists, no host filesystem/secrets access, network egress policy, abuse monitoring, metering, and an emergency kill switch are tested.
- Reuse the MTG lifecycle contract for ordinary silos: asset/listing → offer → distribution → buyer → settlement → fulfillment → evidence. Music & Media, vinyl and auctions, FightEdge, templates, boilerplate, stencils, word banks, and model assets are normal catalog verticals, not separate privileged platforms.
- Build marketplace capabilities as small independently testable slices: listings, search, portable evidence, agent-readable catalog, seller controls, buyer discovery, checkout, fulfillment, refunds, moderation, and support.
- DOOH inventory must include authorized placement, creative approval, play logs, audience measurement limits, and a delivery receipt. Do not claim impressions or campaign delivery without evidence.

**Exit:** measured positive unit economics, isolation/security acceptance tests, external demand, and complete transaction/fulfillment evidence.

## Bounded backlog and ownership

1. **P0 — workflow evidence:** fetch latest 777 cycle and economic-engine run/job/artifact results; classify each failure by owning boundary.
2. **P0 — domain and static deploy:** confirm Render workspace, identify the exact target service and custom-domain ownership, deploy only after mapping is unambiguous, then run external smoke tests.
3. **P0 — source grounding:** test PR #546 against the fallback candidate path; an unavailable model cannot create a synthetic offer.
4. **P0 — DB read path:** test Session Pooler and obtain a read-only schema snapshot before any migration.
5. **P1 — webhook containment:** rotate exposed legacy signing secret through authorized account action; verify active endpoint routing and retire the legacy function safely.
6. **P1 — atomic payment evidence:** implement against the canonical schema only after inspection; add concurrency, idempotency, replay, and causal-link tests.
7. **P1 — Agent Bridge receipts:** signed receipts, lease/fencing enforcement, recipient verification, stale-worker rejection, reconnect and duplicate-event tests.
8. **P1 — first-dollar experiment:** choose one existing offer only from real demand evidence; run the complete buyer-to-delivery journey.
9. **P2 — community-input economy:** pilot creator-approved prompt rounds, licensed media clips, reusable community assets, and sponsored opt-in research. Explicit rights and moderation first.
10. **P2 — GPU/DOOH:** benchmark first; third-party execution and paid campaign delivery stay gated by isolation and evidence.
11. **P3 — scale cohorts:** publish only unique, sourced, materially useful pages. Release cohorts against measured indexing and conversion evidence; do not promise traffic or domain authority.

## Current blockers, not hidden

- The connected GitHub workflow jobs/artifacts endpoints returned 404 for user-supplied run ID `11203498521`; the pasted output is not independently verified by that identifier.
- The live `dreamledger.org` root still returned the legacy “Dream Ledger Deck” title in the latest external check. The new source is committed, but production routing is not verified.
- Render operations require explicit confirmation of the workspace before service/domain inspection or mutation. The workspace previously surfaced as “My Workspace”; no domain change has been performed.
- Supabase direct DB inspection previously failed with `ECONNREFUSED` on IPv6 port 5432; Session Pooler remains to be tested.
- Legacy Stripe webhook secret exposure requires authorized containment.
- Verified external revenue remains NZ$0.00.

## Definition of done

Every slice must produce one of: (a) a verified external economic outcome, (b) a new tested reusable component, or (c) a concise diagnostic explaining the precise boundary and next automated recovery step. Persist code/tests/specs to GitHub, decision/receipt to Notion, and a compact status snapshot to Airtable. Never label a source commit, queued workflow, internal receipt, model output, or simulated payment as production proof.
