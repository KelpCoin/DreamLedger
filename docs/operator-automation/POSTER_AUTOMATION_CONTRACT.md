# Operator Automation Poster Contract

These posters are executable-thinking aids for the autonomous revenue engine. A poster is not complete merely because it is visually clear. It must encode enough structure for an agent or operator to reconstruct the procedure without rediscovering it.

## Required machine-readable sequence

`TRIGGER -> INPUTS -> AUTHORITY -> DECISION -> ACTION -> VERIFICATION -> EVIDENCE -> FAILURE -> ESCALATION -> RESUME`

## Required properties

- Unique `RUNBOOK_ID`
- Explicit trigger condition
- Named authoritative inputs
- Deterministic decision points where possible
- Explicit permitted actions
- Verification after every consequential action
- Evidence produced by the procedure
- Failure and quarantine states
- Human escalation boundary
- Resume procedure
- Idempotency or duplicate-execution rule where applicable
- Timeout or SLA where applicable
- Kill/pause condition where applicable

## Human-time objective

Every poster should eliminate a repeated lookup, decision, copy/paste operation, investigation, or recovery procedure. Human intervention is reserved for authority-bound, irreversible, high-risk, or genuinely unknown states.

## Canonical visual vocabulary

- TRIGGER: what starts the procedure
- INPUTS: data required to act
- AUTHORITY: source that is allowed to establish truth
- DECISION: deterministic gate or explicitly unresolved judgment
- ACTION: system operation
- VERIFICATION: proof that the action worked
- EVIDENCE: immutable or attributable record
- FAILURE: bounded unsuccessful state
- ESCALATION: minimum information required from a human
- RESUME: exact condition for returning to automation

## Safety rules

1. Never convert UNKNOWN into TRUE by assumption.
2. Never hide an exception to make the automation appear healthy.
3. Never execute an irreversible action without an explicit authority boundary.
4. Preserve evidence before recovery or mutation when practical.
5. Prefer idempotent operations.
6. Quarantine ambiguous states instead of guessing.
7. A human escalation must contain enough evidence to avoid re-investigation.
8. Repeated human intervention should become a candidate for automation.
