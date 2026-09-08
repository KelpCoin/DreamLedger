# AgentBridge Economic Highway 1.2

## Purpose

AgentBridge remains the single bespoke transport between LLM agents and the DreamLedger control plane. It is deliberately wider than the current traffic requirement without creating a second bridge.

Canonical topology:

`Grok / ChatGPT / Claude / Luna / specialist agents -> AgentBridge -> Supabase control_bridge_notes -> correlation chain -> Truth Oracle / Gauntlet / fulfillment / downstream agent`

Airtable and Notion remain presentation or human-cockpit surfaces. They are not transport and they are not economic truth.

## Routing lanes

Every structured event now carries a bounded routing envelope:

- `discovery`: raw demand, candidate finding, host motion
- `evidence`: source material and proof attachment
- `evaluation`: delivery and commercial assessment
- `approval`: human authorization boundary
- `execution`: approved consequential work
- `payment`: payment observations only
- `fulfillment`: delivery state
- `reconciliation`: post-payment accounting and verification
- `arbitrage`: cross-signal opportunities for later evaluation

The `arbitrage` lane is a signal lane, not an autonomous trading or financial execution permission.

## Forward-compatible routing metadata

Structured events may carry:

- `priority` from 0 to 100
- `silo_id` using the `SILO_*` namespace
- `source_system` and bounded `source_ref`
- `economic_intent`
- `required_capabilities`, capped at 20
- `suggested_next_agents`, capped at 12
- `ttl_seconds`, from 60 seconds to 7 days
- `expires_at`
- `parent_event_id`

This allows future traffic to fan out to multiple specialist agents without changing the transport contract. The bridge records suggested destinations; it does not autonomously execute consequential external actions.

## Economic invariants

1. Agent claims never become revenue truth.
2. `PAYMENT_DETECTED` never seals RA_000001.
3. Verified revenue still originates from the signed Stripe Truth Pipe and revenue ledger.
4. `ACTION_EXECUTED` requires a matching `ACTION_APPROVED` event.
5. Human approval remains mandatory for consequential external actions.
6. Silo identity is carried on the event so adjacent activity can be routed without collapsing hard-isolated businesses into one context.
7. Idempotency is enforced first by indexed lookup and finally by the database unique event ID constraint.

## Performance and scale posture

The bridge now queries `control_bridge_notes` by indexed `event_id` and `correlation_id` rather than scanning recent rows and parsing every event. Lane, priority, silo, and expiry indexes make future higher-volume routing queryable without replacing the bridge.

The design intentionally does not add queues, message brokers, autonomous posting, autonomous financial execution, or new payment rails before the first verified stranger payment. Width is added to the envelope and persistence boundary, not to economic risk.

## Evidence boundary

Offline contract tests prove the envelope and policy rules. They do not prove authenticated production Grok-to-bridge traffic. That remains a separate live evidence gate and must be recorded only after a real authenticated request succeeds.
