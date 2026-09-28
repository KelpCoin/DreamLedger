# DISPATCH SEMANTICS AUDIT
Date: 2026-09-29

## Finding
The execution packet status DISPATCHED was ambiguous. It was being used for internally routed work and for packets that had reached a blocked terminal state without external authorization.

## Live production result
Current DISPATCHED packets:
- ACNC_RESEARCH_WORKER: dispatch_state=INTERNAL_ROUTED, authorization verdict=allow. This is an internally authorized research/fulfillment path, not proof that an external proposal or transaction was sent.
- Four legacy beck-execution packets: dispatch_state=EXTERNAL_BLOCKED, no authorization decision. These did not leave the system.

No packet inspected has dispatch_state=EXTERNAL_SENT or EXTERNAL_RESULT_OBSERVED.

## Remediation
Added dispatch_state to economic_execution_packets and recorded the migration in supabase/migrations/20260929_dispatch_state_semantics.sql.

The old status remains for compatibility. New interpretation must use dispatch_state when distinguishing internal routing from external action.

## Capability naming
beck-execution is a legacy generic capability identifier reused across unrelated preparation paths. It is not evidence of the Peggy/BECK learning silo being involved. It must not be treated as a domain identity. New packets should use registered capability IDs specific to their actual bounded function.

## Economic truth
This audit does not alter revenue, buyer or settlement truth. No external economic outcome is promoted by this remediation.

## Public surface
This distinction is internal control-plane information and must not be exposed as customer-facing architecture. The public site should communicate offers, worlds, orders and evidence, not packet-state implementation.
