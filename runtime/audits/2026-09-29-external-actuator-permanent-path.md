# External Actuator Permanent Path

Date: 2026-09-29

The recurring first-dollar blocker was not economic qualification. It was the absence of a reusable authenticated external actuator.

This change closes the machine-side gap without changing economic truth.

Existing substrate reused:

- public.economic_actuators / generic_external_action
- public.jobs / EXTERNAL_ACTION
- public.economic_execution_packets
- public.economic_job_events
- economic-actuator-bridge
- existing authorization and dispatch semantics

No second economic ledger is introduced.

Permanent behavior:

1. A real browser worker authenticates once through a persisted browser storage state.
2. The worker heartbeats generic_external_action.
3. The worker reconnects already-prepared packets stranded at DISPATCHED + INTERNAL_ROUTED + job_id NULL.
4. The worker claims only EXTERNAL_ACTION jobs through the existing lease RPC.
5. The worker requires an exact browser execution specification. It never guesses selectors or target text.
6. On a confirmed external submission it records EXTERNAL_SENT.
7. On failure it records the job failure and leaves economic truth unchanged.
8. No payment or revenue counter is written by the actuator.

Enrollment requires repository runtime credentials:

- EXTERNAL_ACTUATOR_TOKEN
- EXTERNAL_ACTUATOR_STORAGE_STATE_B64

The storage state is an authenticated browser session created by the owner. It is not logged and is deleted from the runner filesystem after execution.

Human authorization remains upstream of the external job. EXTERNAL_SENT is execution evidence only and does not imply buyer response, payment, fulfillment, or verified revenue.

Current truth remains:

VERIFIED_EXTERNAL_REVENUE = NZ$0.00
SETTLED_EXTERNAL_PAYMENTS = 0
INDEPENDENT_EXTERNAL_BUYERS = 0
VERIFIED_ECONOMIC_OUTCOMES = 0
