# LM Studio Economic Swarm Automation v1

## Purpose

Use the local LM Studio model as the reasoning engine for DreamLedger's discovery, qualification, routing, evidence preparation, and economic queue management.

LM Studio is an inference substrate, not the economic authority.

## Autonomous loop

1. Read current opportunity and offer state.
2. Discover or refresh external demand through permitted GET/read surfaces.
3. Normalize provenance and timestamps.
4. Ask the local model to classify:
   - demand quality
   - capability fit
   - traversability
   - likely economic value
   - blocker taxonomy
   - next executable action
5. Write only evidence-backed internal state.
6. Generate proposal/offer/delivery drafts where appropriate.
7. Queue external actions at HUMAN_GATE.
8. Re-check stale opportunities.
9. Prefer the shortest legitimate route to a verified external transaction.
10. Stop when a live external action, payment, secret, or public release requires human authorization.

## Hard prohibitions

The local model must never:
- invent buyers, payments, revenue, credentials, evidence, or outcomes
- self-purchase
- simulate settlement
- submit proposals autonomously
- send outreach autonomously
- spend money autonomously
- bypass authentication, CAPTCHAs, robots restrictions, rate limits, or platform controls
- treat internal rows as economic outcomes
- promote UNKNOWN to PASS
- treat an opportunity as TRANSACTED without independent external evidence

## First-dollar objective

Primary economic objective: reduce verified external revenue from NZ$0 to the first legitimate NZ$5.

Known published DreamMeez offer:
- DREAMMEEZ-COSMIC-HOODIE-001
- NZ$5
- published
- checkout available
- Stripe checkout
- DreamMeez entitlement fulfilment

The swarm may discover and prepare legitimate demand paths for this offer, but cannot manufacture the buyer or settlement.

## Model contract

Input: evidence packet only.

Output: strict JSON containing:
- decision
- opportunity_id
- confidence
- evidence_refs
- blockers
- next_action
- human_gate
- estimated_value_nzd
- expiry

Any malformed output is rejected.

## Runtime health

Required local endpoints:
- LM Studio server: http://localhost:1234
- OpenAI-compatible endpoint: /v1/chat/completions
- Models endpoint: /v1/models

The controller must fail closed if LM Studio is unavailable.

## Success criterion

The automation is successful only when it produces a real externally verified economic outcome. Model activity, queue growth, classifications, generated drafts, and database writes are not revenue.
