# Economic Operating Loop v1

Status: DEPLOYED / UNPROVEN_EXTERNAL_ECONOMIC_EFFECT

The production control plane now has a database-owned autonomous economic loop.

## Loop

WORLD -> economic_demand_signals -> cube_opportunities -> deterministic qualification -> capability match -> authority policy -> execution packet -> jobs -> lifecycle events -> external outcome -> economic_outcomes -> economic_business_truth -> learning.

## Autonomous work

Supabase Cron runs:
- economic-operating-loop-5m
- economic-packet-dispatch-5m

The operating tick:
1. reclaims expired jobs
2. schedules bounded external-demand scan jobs from enabled demand adapters
3. converts routed demand signals into cube_opportunities
4. applies deterministic buyer/freshness/evidence/fit thresholds
5. matches a fulfillment capability
6. evaluates executable authority policy
7. creates an execution packet with exact action, predicted postcondition, verification predicate, budget, evidence plan, and kill conditions
8. dispatches authorized packets into the existing jobs queue

## Authority

GREEN: internal discovery, qualification, research, packet construction, verification, learning.

AMBER: external communication/publication. Staged only.

RED: spending, charging, new credentials, irreversible/security/legal actions. Human approval remains mandatory.

Tool access is not authority. The database policy is the authority boundary.

## Capability truth

bec_capability_registry now distinguishes declared/contract-verified capabilities from runtime verification. A capability is not treated as a project. It is a callable contract with source, input/output contract, cost, reversibility, external-effect flag, autonomy lane, health state, and verification evidence.

## Economic truth

economic_business_truth counts only outcomes classified VERIFIED. Verified revenue requires an observed external reference and evidence. Tests, simulations, unverified outcomes, and contradictions do not count as revenue.

## Attribution

Verified autonomous outcomes must retain opportunity_id, action_id, execution_job_id, and external_reference. The causal chain is therefore explicit instead of inferred from whichever offer/action happens to be newest.

## Current proof

A real external demand signal already present in production was converted into:
- opportunity: OPP-N8N-20260908-PAID-WORKFLOW-001
- status: SELECTED
- authority: GREEN for internal packet construction
- execution packet: 0251605f-af45-43b3-8fe0-49a7c0d5bef1
- job: 934f6c73-cf55-4b46-a883-13d5aecd475e

This proves the internal discovery -> qualification -> capability -> authorization -> packet -> job transition.

It does NOT yet prove an autonomous external buyer interaction, payment, fulfillment, or verified revenue. Those remain separate evidence gates.
