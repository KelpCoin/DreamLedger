# TRAVERSABLE OPPORTUNITY SWARM v1

## Objective

Scale opportunity discovery without scaling false positives.

The swarm must search for 10,000+ externally observable offers, but only opportunities that can cross the complete economic graph are allowed into the executable queue.

Graph:

DEMAND
-> DISCOVERY
-> IDENTITY
-> AUTHORITY
-> ACCESS
-> TRUST
-> NEGOTIATION
-> AGREEMENT
-> EXECUTION
-> SETTLEMENT
-> FULFILLMENT
-> REPUTATION
-> REPEATABILITY
-> SCALE

## Hard admission rule

An opportunity is TRAVERSABLE only when every required edge has an evidence-backed state:

PASS       evidence exists and is currently usable
BLOCKED    known obstacle prevents the edge
UNKNOWN    evidence is missing
EXPIRED    previously valid evidence is stale
NOT_APPLICABLE only when the path genuinely does not require that edge

UNKNOWN is never promoted to PASS.

STRUCTURALLY_UNAVAILABLE is emitted when a required edge is BLOCKED or when an essential edge is UNKNOWN and cannot be resolved through an available lawful access surface.

## Required dimensions

representation_chain
settlement
reversibility
access_surface
platform_dependency
reputation_scope
demand_reachability
liquidity
contribution_margin_after_external_tolls
throughput
dependency_health
temporal_consistency
jurisdiction
data_availability
incentive_alignment
exit_cost
obligation_load

## Opportunity states

OBSERVED
TRAVERSABILITY_PENDING
TRAVERSABLE
STRUCTURALLY_UNAVAILABLE
EXPIRED
HUMAN_GATE
SUBMITTED
TRANSACTED
FULFILLED
VERIFIED

TRAVERSABLE does not mean purchased.
FULFILLED does not mean paid.
Only VERIFIED economic outcomes count as revenue truth.

## Swarm scaling rule

Discovery scale is independent from economic truth.

The swarm may observe 10,000, 100,000 or 1,000,000 offers.

It may not manufacture:
- buyers
- budgets
- authorization
- payment
- fulfillment
- outcomes
- reputation
- evidence

Each observation must retain:
source
source_reference
observed_at
subject
commercial terms when actually observed
required capability
access surface
provenance

## Routing

1. DISCOVERY workers maximize breadth.
2. TRAVERSABILITY workers eliminate dead ends.
3. CAPABILITY matching eliminates jobs the system cannot fulfill.
4. ECONOMIC qualification ranks surviving paths by contribution margin, not gross value.
5. HUMAN_GATE is reserved for irreversible external actions.
6. TRANSACTION and FULFILLMENT workers execute only after authorization.
7. TRUTH verification records only independently evidenced external effects.

## Million-scale design

Do not create one agent per offer.

Use a swarm of bounded workers operating over partitions:

source x geography x category x price band x capability x platform

Workers return observations, not authority.

A coordinator deduplicates by opportunity_key and routes only surviving candidates.

The scaling target is:

10,000 observed offers
-> 10,000 provenance records
-> traversability filter
-> capability filter
-> economic filter
-> small executable queue
-> human-approved external actions
-> verified transactions

The shrinking funnel is intentional.

## Current DreamLedger reality

Current cube_opportunities:
121 total
10 INTERESTING
14 execution packets
6 priced opportunities

Current economic_demand_signals:
904 total
895 ROUTED
9 QUARANTINED

Current verified revenue remains NZ$0.

Therefore the immediate bottleneck is not silo count. It is conversion of observed demand into traversable, capability-matched, externally actionable paths.

## No fake scaling

Increasing database rows without increasing independent external observations is prohibited.

A million-row table is not a million-offer market.

A million offers with zero traversable paths is still zero transactions.

The swarm wins by increasing the number of legitimate external paths tested per unit of human attention.
