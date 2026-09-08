# AgentBridge and Grok relay contract

## Canonical topology

The agent-to-agent bridge is DreamLedger AgentBridge backed by Supabase.

`Grok -> authenticated AgentBridge -> Supabase control_bridge_notes -> correlation chain -> downstream agent`

Airtable and Notion are not the transport layer and are not the economic authority.
They may be used as human-readable cockpit surfaces only.

Economic truth remains in Supabase. GitHub remains the reproducible source for code, migrations, governance, and proof artifacts.

## Existing bridge

Canonical runtime:

`BEC-PRIME/runtime/AgentBridge.js`

Canonical live route family:

`/api/agent-bridge/*`

Authentication:

`x-dreamledger-agent-token`

Grok is an allowed bridge agent and may originate `CANDIDATE_FOUND` and `EVIDENCE_ATTACHED` events. The bridge records structured events in `control_bridge_notes` with correlation IDs so the same economic thread can be inspected by other agents.

## Supabase hardening

`control_bridge_notes` now has database-backed `event_id` and `correlation_id` columns populated from structured-event JSON by a trigger.

The database also enforces a unique `event_id` for structured events. This closes the previous race in which two concurrent requests could both pass the application-level recent-event scan and create duplicate structured events.

Indexes cover note type plus creation time and correlation ID plus creation time.

The database constraint is the final duplicate guard. Application-level idempotency remains useful for normal retries, but it is no longer the only protection.

## Governance boundary

The bridge does not make RA_000001 true.

`PAYMENT_DETECTED` is an informational structured event only. Verified revenue still comes exclusively from the production Stripe Truth Pipe and the revenue ledger.

`ACTION_EXECUTED` still requires a corresponding `ACTION_APPROVED` event.

Consequential external actions remain human-approval gated.

## Grok handoff shape

A Grok-originated event should contain at least:

- `event_id`: globally unique event identifier
- `correlation_id`: stable identifier for the economic thread
- `event_type`: for example `CANDIDATE_FOUND` or `EVIDENCE_ATTACHED`
- `agent`: `grok`
- `subject_type`
- `subject_id`
- `claim`
- `evidence`
- `confidence`
- `requested_action` when applicable

The bridge is the shared relay. No Airtable or Notion copy is required for an agent handoff.

## Current limitation

The bridge contract is present in code and the Supabase persistence boundary is hardened, but an authenticated live Grok-to-production request is still an evidence gate. Do not mark that path VERIFIED until a real authenticated request is observed and a proof artifact records the result.
