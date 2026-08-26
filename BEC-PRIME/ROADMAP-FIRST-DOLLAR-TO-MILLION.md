# First Dollar to First Million Roadmap

Date: 2026-08-27
Opportunity: INVSHOP-001
Silo: inverse-shopping
Status: EXECUTION-READY
Public actions: APPROVAL-GATED

## North Star

Build the smallest repeatable economic loop:

WANTED -> LIVE MARKETPLACE HUNT -> VERIFIED MATCH -> CUSTOMER DELIVERY -> PAYMENT -> LEDGER

Do not treat architecture completion as commercial validation.

## Gate 0 - Computer Session

Objective: prove the machine is ready to execute.

Required:
- Windows 11 workstation available.
- BrownEye Cortex paths available.
- Python and requests available.
- eBay credentials available as environment variables only.
- Proof directory on D: exists or can be created.
- No credentials written to source control.
- Public posting remains disabled.

Exit evidence:
- local readiness proof
- verifier command succeeds

## Gate 1 - EBAY-001

Objective: prove live source feasibility.

Required evidence:
- actual OAuth request
- actual OAuth response status
- token obtained without storing the token in proof
- actual search request
- actual search response
- HTTP 200
- at least one returned listing
- normalized candidate
- source currency captured from provider response
- shipping fields captured when supplied
- NZ delivery assessment derived from provider data
- price cap assessment
- matching dimensions
- cryptographic proof hash
- independent verification

No gate may be PASS merely because code executed.

Exit condition:
EBAY-001 = PASS.

## Gate 2 - COMMERCIAL-001

Objective: prove willingness to pay.

Initial offer:
NZ$15 manually fulfilled wanted-item hunt.

Evidence:
- real prospect request
- payment provider evidence
- fulfilment evidence
- result delivered
- ledger event

Exit condition:
one real external payment.

## Gate 3 - Repeatability

Run 20 qualified opportunities.

Measure:
- qualified requests
- paid requests
- hunt success rate
- fulfilment time
- revenue
- refunds
- repeat demand
- acquisition source

Kill condition:
fewer than 2 qualified prospects in the first 10-target test, or acquisition cost exceeds the approved test ceiling.

## Gate 4 - Automation

Automate only proven work:
- wanted parsing
- marketplace search
- candidate normalization
- ranking
- evidence capture
- customer result generation
- payment reconciliation
- ledger recording

Human remains approval point for exceptional cases and consequential public actions.

## Gate 5 - $1K

Find repeated demand clusters and package the strongest verticals.

Potential verticals are hypotheses, not commitments.

The data chooses the next lane.

## Gate 6 - $10K

Improve:
- acquisition
- conversion
- fulfilment margin
- repeat purchase
- referral
- marketplace coverage

Primary operating metric:
revenue per minute of human attention.

## Gate 7 - $100K

Build distribution around proven verticals.

DreamLedger horizontal carousel is a distribution surface, not proof of demand.

Keep:
- MTG isolated
- inverse-shopping isolated
- adult/Amplissa isolated

## Gate 8 - $1M

Compound the proven engine through:
- multiple validated verticals
- repeat customers
- automated fulfilment
- distribution
- marketplace coverage
- digital products where evidence supports them
- identity/avatar/game layers only where they improve economics

## Hard Rules

1. No invented revenue.
2. No manufactured PASS states.
3. No credentials in Git.
4. No public posting without explicit approval.
5. No MMO build work before the economic engine earns the right to consume engineering time.
6. Every execution session produces a proof artifact and verifier command.
7. Failed gates are evidence, not something to cosmetically rename.

## Current Next Action

Run the local first-dollar bootstrap.

The bootstrap must stop safely if credentials or the live eBay implementation are missing. It must never fake a successful source response.
