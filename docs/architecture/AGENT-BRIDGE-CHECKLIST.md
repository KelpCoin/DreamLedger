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

## Invariant

There must be no supported production path from an unqualified signal or unconstrained agent directly to an external side effect.

## Current status

Schema/contract: IMPLEMENTED IN BRANCH.
Runtime wiring: NOT YET VERIFIED.
External economic truth: unchanged. No verified revenue is created by this work.
