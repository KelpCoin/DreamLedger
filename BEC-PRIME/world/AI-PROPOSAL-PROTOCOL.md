# AI Proposal Protocol v1

The World Architect is a proposal engine, not an autonomous sovereign.

## Input signals

- player population by floor
- compute and content demand
- resource supply and depletion
- market prices and transaction volume
- guild ownership and territorial activity
- crafting and logistics flows
- combat activity
- retention and abandonment
- player search and creation demand

## Proposal classes

- RESOURCE_SPAWN
- RESOURCE_BALANCE
- FLOOR_CONFIGURATION
- QUEST
- BOSS
- ASSET
- CRAFTING_RECIPE
- GUILD_OBJECTIVE
- MARKET_MECHANIC
- TERRITORY_RULE
- COMPUTE_ALLOCATION
- CONTENT_ALLOCATION

## Required proposal envelope

Every proposal must contain:

1. proposal_id
2. policy_version
3. observed_signals
4. hypothesis
5. proposed_change
6. expected_effects
7. player-impact analysis
8. economic-impact analysis
9. anti-exploit analysis
10. simulation plan
11. rollback plan
12. approval state

## Decision pipeline

OBSERVE -> PROPOSE -> POLICY CHECK -> SIMULATE -> GAUNTLET -> HUMAN APPROVAL -> GITHUB ACTION -> DEPLOY -> OBSERVE

## Hard prohibitions

The proposal engine must not:

- fabricate economic events
- fabricate players or purchases
- silently alter player ownership
- silently alter settled balances
- create artificial scarcity solely to manipulate prices
- publish public communications without approval
- bypass simulation or approval for production economy changes

## Resource ecology rules

Procedural resources may be generated with finite quantities, extraction rates, geographic constraints, regeneration rules, and epoch boundaries. Generation should create meaningful competition without requiring artificial scarcity.

A resource proposal should consider downstream demand on lower floors, upstream production capacity, guild concentration, logistics cost, market concentration, expected player participation, and exhaustion risk.

## Dynamic world allocation

Infrastructure and content-generation budgets may shift toward floors with higher observed population, activity, economic importance, or simulation load. Allocation changes are operational decisions and must not alter player ownership or settled economic truth.

## Digital proxy boundary

The policy file represents explicit design principles. It is not a personality clone, legal agent, autonomous representative, or authority to speak for the operator. It is a deterministic policy constraint for evaluating machine-generated proposals.
