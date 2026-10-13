# Frantic and GPU Acquisition Update - 2026-10-14

Status: READ-ONLY research. No account registration, identity seals, wallet configuration, bounty claim, paid submission, or public post was performed.

## New GitHub findings

Search of the public auscaster/frantic-board mirror found:
- Issue #425 asks whether there is a currently funded, non-promotional task in the verified-contact entry tier. It explicitly notes that the visible low-tier tasks may require an established Reddit account, external editorial citation, or funding a bounty first. This contradicts the assumption that a suitable low-friction task is guaranteed.
- Issue #277 mirrors bounty #97, "Your first bounty is on the house ($10 back when it clears, first five)", marked available in that mirror. This is a historical/current-at-mirror observation, not proof that the promotion is still available or that participation is free: the task appears to involve funding a bounty and may require capital first. Do not participate without verifying the live offer, rebate conditions, total amount at risk, and eligibility.
- Issues #431 and #432 mirror tasks #134 and #135 with slots filled; do not target those without fresh live confirmation.
- Issue #476 mirrors #136 with slots filled/delivered; do not target without fresh live confirmation.

Sources:
- https://github.com/auscaster/frantic-board/issues/425
- https://github.com/auscaster/frantic-board/issues/277
- https://github.com/auscaster/frantic-board/issues/431
- https://github.com/auscaster/frantic-board/issues/432
- https://github.com/auscaster/frantic-board/issues/476

## Candidate public codebases found

Repository search surfaced:
- https://github.com/webmilmind1/x402-bounty-hunter
- https://github.com/twzrd-sol/x402-bounty-hunter
- https://github.com/TheBarmaEffect/origin-agent-bounty-hunter
- https://github.com/tmdry4530/agent-bounty-hunter
- https://github.com/clawhunter/threews-bounty-skill

These are candidates for read-only source inspection, not endorsements or safe-to-run packages. Before execution, inspect source, package scripts, dependencies, wallet handling, network calls, and whether read-only mode is truly read-only. Never pass a private key into an unreviewed package. Prefer a separate low-value wallet only after explicit approval and independent code review.

## Updated decision table

| Route | Value proposition | Principal blocker/risk | Decision |
|---|---|---|---|
| Frantic #130 Reddit task | Low nominal reward; GPU can research/draft | Current task may require aged Reddit account and karma, plus manual posting | Hold until exact live terms and identity eligibility confirmed |
| Frantic #128 registry citation | Potential $8 | Must establish a qualifying external citation and current gate | Check exact live task; draft evidence only |
| Frantic #129/#127 | $16/$20 nominal | Higher eligibility gate; account age alone not proven sufficient | Recheck gate after successful eligible paid task |
| Frantic #97 rebate | Advertised $10 rebate | Funding exposure; promotion availability and eligibility unverified | Do not fund or claim without explicit approval and exact terms |
| DeskCrew x402 | Potential positive expected value on suitable rewards | Historical approval rate is not personal win probability; transaction fees and key exposure | Read-only board + source review first; no --live |
| Superteam Earn | Occasional high-value agent-eligible work | Listings may be HUMAN_ONLY; rare eligibility | Poll public listings only; do not register with invented or placeholder personal data |
| GitHub bounty-hunter repos | Reusable tooling ideas | Untrusted code and wallet/network permissions | Inspect source before running; reuse design patterns, not blind installs |
| DreamLedger payment path | Larger compounding upside if payment-to-delivery chain works | Supabase, checkout, settlement, attribution and fulfillment still need proof | Continue repair before offer activation |

## DeskCrew EV guardrail

If the quoted $1 reward, 85% worker share, 21% acceptance rate and $0.06 fee all apply to one attempt, estimated EV is $0.1185 before other costs. This is a population-based estimate, not a guaranteed individual return. If the actual acceptance chance is lower, EV falls. Recompute from live board terms each time.

## Next actions

1. Capture raw Frantic live board and exact bounty detail responses with timestamp, HTTP status and SHA-256. Resolve any conflict with GitHub mirrors.
2. Read #130 and #128 full instructions and determine if the required account/identity is available and authorized. Do not post publicly without approval.
3. Read-only inspect x402-bounty-hunter source and package metadata; no wallet key and no live mode.
4. Keep the first-dollar target tied to a real accepted deliverable and independently verifiable settled payment.
5. Do not count rebates, pending claims, checkout sessions, simulated outcomes, or historical wallet transfers as DreamLedger revenue.

## Verifier

Open this file and confirm it remains research-only:
https://github.com/KelpCoin/DreamLedger/blob/audit/economic-recovery-register-2026-10-14/docs/FRANTIC-GPU-ACQUISITION-UPDATE-2026-10-14.md
