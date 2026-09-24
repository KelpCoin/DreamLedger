# BEC PRIME BUG REFINERY

Status: ACTIVE

Purpose: every material bug, blocker, regression, or failed economic transition must be treated as an engineering search problem, not a reason to stop.

## Mandatory repair protocol

For each newly observed bug:

1. Capture the exact symptom and evidence.
2. State the broken contract in one sentence.
3. Generate exactly ten materially different repair paths.
4. For each path record: mechanism, dependencies, risk, reversibility, verification method, and expected economic effect.
5. Reject fixes that fabricate evidence, bypass approval gates, weaken silo separation, move money without authorization, or hide the failure.
6. Select the smallest safe repair that restores the broken contract and advances the economic loop.
7. Apply the selected repair when the execution environment authorizes it.
8. Run the verifier immediately.
9. If verification fails, record the failure and move to the next viable repair rather than declaring success.
10. Write the complete ten-option analysis, selected repair, implementation evidence, verifier result, and remaining blocker to cloud disk.
11. Preserve the previous evidence. Never overwrite history merely to make the system look healthy.
12. Promote a repair pattern for reuse only after it has produced reliable evidence.

## Required record

Each repair record must contain:

- bug_id
- observed_at
- symptom
- evidence
- broken_contract
- ten_repairs
- selected_repair
- selection_reason
- files_changed
- deployment_or_execution_reference
- verifier
- verifier_result
- economic_state
- remaining_blocker
- next_transition

## Economic rule

A successful software repair is not a successful revenue event. Revenue remains VERIFIED only after an unknown external buyer pays, payment settles, attribution is correct, fulfilment occurs, and independent proof exists.

## Autonomy rule

Routine inspection, diagnosis, code changes, tests, commits, safe deployments, reconciliation, and repair attempts may proceed autonomously where already authorized. External publication, outreach, spending, charging, refunds, and irreversible commercial or legal actions remain approval-gated.

## Current mandate

Do not wait for Biggie to design the repair. The system must do the ten-option search itself, apply the safest useful repair it is authorized to apply, verify it, and leave the result on cloud disk.
