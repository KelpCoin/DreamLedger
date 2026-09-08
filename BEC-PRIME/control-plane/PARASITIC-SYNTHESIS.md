# BrownEye Parasitic Synthesis Registry

Purpose: shorten implementation time by harvesting mature open-source control-plane, governance, evaluation, and evidence patterns instead of rebuilding them.

Rule: borrow architecture aggressively, copy code only when its license permits it, preserve required notices, and adapt interfaces to BrownEye's existing Node/PowerShell/Supabase proof model. Never import credentials, proprietary code, or an entire framework merely because it is fashionable.

## Adopt now

### 1. ryanwi/agent-control-plane
License: MIT.

Borrowed patterns:
- deterministic policy enforcement before execution
- explicit human approval gates
- budget/token governance
- kill switches and concurrency guards
- precondition verification
- durable event history and replay
- separation of control plane from data plane

BrownEye mapping:
- PolicyEngine -> Truth Oracle/Gauntlet admission checks
- ApprovalGate -> Biggie approval
- BudgetTracker -> Treasury/economic limits
- KillSwitch -> emergency release stop
- EventStore -> existing event ledger/proof receipts

Source: https://github.com/ryanwi/agent-control-plane

### 2. GauntletVectorLabs/gauntlet
License: MIT.

Borrowed patterns:
- deterministic adversarial probe library
- attack categories for injection, scope drift, false premises, malformed input and runaway behavior
- severity-ranked findings
- regression suites suitable for CI
- optional LLM-generated adversaries layered over deterministic probes

BrownEye mapping:
- Gauntlet probes become a reusable pre-release attack corpus
- every important silo can contribute domain-specific probes
- failures become regression evidence rather than disappearing after a fix

Source: https://github.com/GauntletVectorLabs/gauntlet

## Architecture references

### 3. FINOS OpenEAGO
License: Apache-2.0.

Use as a governance/protocol reference, not as a dependency by default. It explicitly separates governance and orchestration concerns and defines an open enterprise governance/control-plane specification.

Source: https://github.com/finos-labs/open-eago

### 4. BoundFlow
License: Apache-2.0.

Borrow patterns for durable execution, lifecycle governance, approvals, audit receipts and observability. Do not replace BrownEye's existing release machinery with BoundFlow unless a measured integration removes more complexity than it introduces.

Source: https://github.com/boundflow/boundflow

### 5. UACP
Use as an architectural reference for separating governance, deliberation, coordination and execution. The invariant is useful even if no code is imported.

Source: https://github.com/mikeng-io/uacp

## Deliberately not copied

- Elohim Protocol: useful conceptual/reference architecture, but not a direct control-plane dependency.
- Unlicensed or unclear-license Gauntlet implementations: inspect ideas, do not copy code.
- Large orchestration frameworks when BrownEye already has equivalent machinery.

## BrownEye synthesis rule

Do not build a second version of something that already exists and is legally reusable.

Prefer, in order:
1. Existing BrownEye implementation if it already satisfies the invariant.
2. Small MIT/Apache-2.0 component or translated pattern that directly closes a gap.
3. Thin adapter around an external component.
4. New BrownEye implementation only when the above cannot satisfy the required authority, determinism, security, or deployment constraints.

## Current Phase-0 implementation

`ControlLoop.js` reuses the existing LM Studio adapter and implements:

PROPOSAL -> TRUTH ORACLE -> GAUNTLET -> HUMAN APPROVAL -> TELEMETRY

No side effect is authorized by this loop. The generated receipt explicitly records `execution_permitted=false` and `public_mutation_permitted=false` until a future approval stage changes the state.

The PowerShell entrypoint is `scripts/Submit-Proposal.ps1`.
