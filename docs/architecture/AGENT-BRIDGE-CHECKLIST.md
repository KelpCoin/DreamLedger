# Agent Bridge Implementation Checklist

## Cloud path

- [x] Define CUBE -> Elohim -> Gauntlet -> Action -> Observation -> Truth lifecycle
- [x] Define immutable correlation/idempotency contract
- [x] Add bridge run state model
- [x] Add transition journal
- [x] Add Elohim proposal record
- [x] Add Gauntlet gate result record
- [x] Add external observation record
- [x] Add Truth Oracle verdict record
- [ ] Wire CUBE Edge Functions to create bridge runs
- [ ] Wire Elohim proposal output into bridge proposals
- [ ] Require Gauntlet certificate before AUTHORIZED
- [ ] Route authorized actions into commerce_actions
- [ ] Record provider request/response references
- [ ] Feed observations into Truth Oracle
- [ ] Promote only qualifying verified outcomes
- [ ] Add automated end-to-end synthetic bridge test
- [x] Add canonical source/category exclusion gate before packet creation
- [x] Add second exclusion gate before economic packet dispatch
- [x] Add fail-closed RLS hardening migration for seven exposed security-sensitive tables
- [x] Mark commerce operational view for security-invoker semantics
- [x] Add canonical AuthZEN-shaped SARC PDP decision seam
- [x] Persist decision_id, trace_id, request_hash, verdict, reasons, and obligations
- [x] Block AUTHORIZED packets without a real PDP allow decision
- [x] Route packet creation through the canonical PDP
- [x] Re-consult PDP after human approval request
- [x] Add explicit authority attenuation fields and database bounds
- [x] Require thirteen evidence claims before economic truth can become VERIFIED
- [x] Add Batch 15 governance regression tests
- [x] Audit public SECURITY DEFINER functions for explicit search_path configuration

## Invariant

There must be no supported production path from an unqualified signal or unconstrained agent directly to an external side effect.

A packet is not AUTHORIZED merely because a caller writes an AUTHORIZED state. The database requires a recorded PDP allow decision whose trace and request hash match the packet.

## Remaining runtime work

- [ ] Refactor deployed economic-activation to call evaluate_economic_authorization() directly
- [ ] Refactor deployed economic-approve caller to surface the PDP re-evaluation result
- [ ] Make agent-bridge-proxy call the same PDP before actuator dispatch
- [ ] Add actor-attributed transport audit records to every bridge dispatch
- [ ] Run the synthetic CUBE -> Elohim -> Gauntlet -> PDP -> Action -> Observation -> Truth trace
- [ ] Apply migrations only after review and controlled staging verification

## Current status

Schema/contract: IMPLEMENTED IN BRANCH.
Runtime wiring: PARTIALLY ENFORCED BY DATABASE GUARD, NOT YET VERIFIED END-TO-END.
Production deployment: NOT PERFORMED BY THIS BATCH.
External economic truth: unchanged. No verified revenue is created by this work.
