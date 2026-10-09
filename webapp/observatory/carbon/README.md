# Carbon Forward Matching Engine: First Cell

Status: DESIGN ARTIFACT, NOT A LIVE TRADING VENUE

## Purpose
Create a safe intake and matching layer for bilateral NZU forward interest. The first deliverable is a non-binding intent record, not an executable trade. A match proposal must never be represented as a contract, settlement, verified NZU holding, or regulatory approval.

## Why this is the first cell
The existing 777 architecture already distinguishes observation, authorization, external result, settlement, fulfillment, and evidence. This vertical can reuse that contract rather than inventing a second ledger. The first cell only needs to capture comparable buyer/seller intent, expose missing evidence, and produce a reviewable match candidate.

## Canonical input
Use `carbon-forward-intent.v1.json` as the schema. It requires a unique intent ID, buy/sell side, quantity, delivery window, price basis, counterparty visibility choice, evidence references, and explicit matching-only consent. Unknown evidence remains `UNVERIFIED`; no field is silently promoted to verified.

## Candidate matching
A candidate pair is eligible for review only when:
1. One side is BUY_FORWARD and the other is SELL_FORWARD.
2. Delivery windows overlap.
3. Quantities can be fully or explicitly partially matched.
4. Price terms are compatible under a disclosed rule.
5. Required authority and delivery evidence has a current verified status.
6. Both parties consented to matching and to the stated identity-disclosure stage.

The matcher should return a candidate and a reason trace, not execute a transaction. It must preserve rejected candidates and reason codes so later cycles can improve matching without rewriting history.

## Required outputs
- Candidate ID and the two intent IDs.
- Matched quantity and delivery overlap.
- Price compatibility result and exact rule version.
- Evidence references with verification timestamps.
- Missing-evidence and risk flags.
- Consent and identity-disclosure state.
- A deterministic digest of the candidate packet.
- Explicit next action: request evidence, human-authorized introduction, reject, or expire.

## Guardrails
- No wallet custody, automated binding offers, or trade execution in this cell.
- No public listing of confidential intent or counterparty identity.
- No claim that a carbon unit exists or will be delivered unless evidence is independently verified.
- No success metric based on candidate count alone.
- Require specialist legal/regulatory review before enabling live brokerage, success fees, or binding agreements.
- Record consent, authorization, external result, and settlement as separate states.
- Fail closed on stale evidence, missing authority, conflicting quantity, or incompatible delivery dates.

## Acceptance tests
1. Buyer and seller with overlapping delivery and compatible fixed prices produce a review candidate.
2. Non-overlapping delivery windows produce no candidate and a stable reason code.
3. Missing authority evidence blocks eligibility.
4. Stale evidence cannot satisfy a verified-evidence requirement.
5. Revoked consent removes the intent from new matching.
6. Replaying the same inputs produces the same candidate digest.
7. No candidate creation mutates revenue, settlement, or fulfillment truth.
8. Candidate output contains no counterparty identity when blinded visibility is selected.

## Next 777 decomposition
HUGE-09: Carbon forward matching cell.
- 09.1 Validate schema against positive and negative fixtures.
- 09.2 Implement deterministic overlap and price-compatibility functions.
- 09.3 Add reason-coded candidate output.
- 09.4 Add consent revocation and evidence-staleness checks.
- 09.5 Wire the candidate artifact into the existing CUBE/AgentBridge job contract only after repository inspection.
- 09.6 Add an offline verifier and replay fixture.
- 09.7 Keep public release blocked until primary sources, legal boundaries, and actual user demand are independently corroborated.

## Truth statement
This artifact is an internal engineering component. It is not proof of market demand, an active marketplace, a completed 777 run, a deployment, or revenue. Verified external revenue remains NZ$0.00 until a real independent buyer's settled payment and delivery evidence are observed.
