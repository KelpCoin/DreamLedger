# DreamLedger Control Desk

Last consolidated: 2026-09-28

## Authority

Gauntlet is the supervisory adversarial authority over both creation and recovery.

- Elohim creates, proposes, refines and constructs under Gauntlet watch.
- Watchdog maintains runtime health and performs bounded recovery under Gauntlet supervision.
- Supervisor orchestrates work and reconciles state.
- Truth Oracle verifies evidence, provenance, contradiction state and economic-data freshness.
- Gauntlet attacks assumptions and controls economic authorization eligibility.
- CUBE searches bounded economic opportunity space.
- External buyer + settled attributable payment + fulfillment + independent proof establish economic reality.

## Non-bypassable freshness invariant

The Gauntlet must never make an economic authorization decision from stale economic data.

STALE
-> NOT GAUNTLET-VALID
-> REFRESH / RESEARCH / QUARANTINE
-> FRESH STATE
-> GAUNTLET RE-EVALUATION

If freshness cannot be established:

NO FRESHNESS -> NO AUTHORIZATION -> QUARANTINE

Freshness is an authority precondition, not merely an evidence score.

## Creation and recovery

Technical success never grants economic authority.

Elohim may build aggressively, but creation is not approval.

The Watchdog may restart LM Studio, recover workers, rebuild bounded runtime tasks or switch execution paths, but recovery is not economic authorization.

A healthy process is not an approved economic action.

## Economic promotion chain

FREE UTILITY
-> INBOUND DEMAND
-> MONEY-AT-RISK PROBLEM
-> SMALLEST SELLABLE INTERVENTION
-> APPROVED EXTERNAL ACTION
-> ATTRIBUTABLE SETTLEMENT
-> FULFILLMENT
-> INDEPENDENT PROOF
-> SECOND TRANSACTION
-> UNIT ECONOMICS
-> AUTOMATION
-> REPLICATION

Promotion law:

SIGNAL != BUYER
BUYER != PAYMENT
PAYMENT != FULFILLMENT
FULFILLMENT != PROOF
ONE PROVEN TRANSACTION != REPEATABLE BUSINESS

## Current truth

VERIFIED_EXTERNAL_REVENUE = NZ$0.00
SETTLED_DREAMLEDGER_PAYMENTS = 0
INDEPENDENT_EXTERNAL_BUYERS = 0
REVENUE_ORDERS = 0
FULFILLMENT_REQUESTS = 0
REPEAT_PURCHASES = 0
RA_000001 = OPEN / UNEARNED

Unmatched Stripe payments are excluded from DreamLedger revenue until attribution, fulfillment and independent proof exist.

## Pre-revenue exit

The immediate target is:

ONE REAL BUYER
-> ONE ATTRIBUTABLE PAYMENT
-> ONE FULFILLED DELIVERABLE
-> ONE INDEPENDENT PROOF
-> SECOND TRANSACTION

No architecture expansion is justified merely by internal activity.

## Runtime watchdog

Monitor:
- process/API health
- model availability
- worker heartbeat
- progress change
- job stall
- required artifacts
- bounded restart/recovery
- escalation/quarantine

Economic supervision remains:

Watchdog recovery
-> Supervisor reconciliation
-> Truth Oracle freshness/evidence check
-> Gauntlet re-evaluation
-> authorization or quarantine

## Cognitive-load rule

The system exists partly to remove operator overhead.

Do not:
- add architecture when the lowest external gate is unchanged;
- repeat a failed action without changed information;
- create duplicate frameworks;
- make Biggie manually reconcile state that machines can reconcile;
- confuse runtime health with economic success.

Human gates remain for consequential public/live-money/irreversible actions, secrets, platform-required manual actions, and decisions that cannot safely be inferred.

## System boundaries

Notion = human-facing control desk, decisions, runbooks and context.
Airtable = operational candidate/control records.
Supabase = machine-facing runtime and economic truth.
GitHub = deterministic source/release/audit mirror.
Local filesystem = cache, artifacts, proofs and offline execution state.
Stripe = payment rail.

Notion is not authoritative for economic truth.

## Live implementation audit

Direct Supabase inspection found that the existing authorization functions recorded policy and approval state but did not enforce candidate freshness at the persisted authorization-decision boundary.

A fail-closed database trigger is now installed on public.economic_authorization_decisions. When an authorization context contains candidate_id, the trigger requires economic_candidate_control_state.all_fresh = true. Invalid candidate identifiers or stale/unknown freshness reject the authorization decision.

Current control-state check: 1 candidate control state exists; 0 are currently fresh; 1 is stale or unknown. Candidate-bound economic authorization is therefore currently blocked until the Supervisor/Truth Oracle pipeline establishes fresh state. This is intentional fail-closed behavior.

GitHub control desk commit: 9c1235b88988e46774ebfd4dd0fbf40b4dae84f5.
Supabase control desk: public.cross_system_control_desk.
Airtable canonical doctrine: DREAMLEDGER_CANONICAL_NORTH_STAR_V1, updated to v2.

This changes the control plane, not economic truth. Verified external revenue remains NZ$0.00.

## Fresh-state execution receipt — 2026-09-28

Supervisor + CUBE controller tick executed at 09:50 UTC and dispatched 6 CUBE refinery research jobs through the existing Elohim → Truth Oracle → Gauntlet → Dealer Hand path. No external action was performed and no revenue was claimed.

Truth Oracle catalog verification ran at 09:50 UTC: 32 catalog SKUs checked, 12 verified and 20 contradicted. This is verification activity, not economic revenue.

Candidate control state was re-read after the Oracle run: candidate `c29b82ec-0357-4da1-b9ee-9521134c97db`, 1 assessment, score 0.78, 0 open disagreements, `all_fresh=false`, gate `WAITING_ASSESSMENTS`. Candidate-bound authorization remains blocked. No synthetic freshness evidence was inserted.

Freshness invariant: STALE → NOT GAUNTLET-VALID → REFRESH / RESEARCH / QUARANTINE → FRESH STATE → GAUNTLET RE-EVALUATION. NO FRESHNESS → NO AUTHORIZATION.

## Canonical references

Notion control desk: https://app.notion.com/p/3e92ee9b45db8142a556c3af4d08fc3e
Supabase control table: public.cross_system_control_desk
Airtable base: DreamLedger Canonical Control
Airtable canonical record: DREAMLEDGER_CANONICAL_NORTH_STAR_V1

## Operating command

BUILD, TEST, REPAIR, SEARCH, VERIFY, LEARN.

Move only the lowest unresolved gate.

No simulation.
No fake buyers.
No fake revenue.
No architecture theatre.
No reset.


## Distribution wedge — 2026-09-30

The immediate commercial wedge is the GETS Opportunity Brief, treated as an offer hypothesis rather than a validated market.

Buyer definition: NZ SME supplier considering government work through GETS.
Qualification: "Have you bid on a GETS tender in the last 12 months?"
Offer hypothesis: evidence-backed tender decoding, including mandatory requirements, supplier fit/gaps, deadline and source/page references.
Intended price hypothesis: NZ$49.
Public checkout state: NOT ATTACHED / NOT VERIFIED. Do not reuse another product's Stripe link.
Fulfillment contract: one sourced brief delivered to the buyer with traceable source references and an attributable delivery record.

Smallest viable distribution system:
1. Three warm-introduction requests per week.
2. One LinkedIn carousel per week.
3. One useful community contribution per week.
4. One free sample brief published.
5. One canonical destination.

Distribution scoreboard is separate from economic truth:
WARM_INTROS_SENT=0
LINKEDIN_CAROUSELS_PUBLISHED=0
COMMUNITY_CONTRIBUTIONS=0
FREE_SAMPLE_BRIEFS=1 when the sample page is publicly reachable
CANONICAL_DESTINATION=GETS Opportunity Brief page
STRIPE_PAYMENT_LINK=UNVERIFIED for this offer

Important distinction: the six proposed dominant failure classes are now recorded as the operating hypothesis for the experiment. They are not promoted to statistically confirmed truth by internal records alone. External claims about conversion rates, procurement statistics, QR concentration, or social engagement require source verification before they become canonical evidence.

The system must not create fake distribution events, fake warm introductions, fake buyers, fake payments or fake outcomes. Public outreach remains a human gate. This plan moves the lowest unresolved external gate without adding a new architecture.
