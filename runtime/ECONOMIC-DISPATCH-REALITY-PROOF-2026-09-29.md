# Economic Dispatch Reality Proof - 2026-09-29

## New finding

The live database contains packets marked DISPATCHED, but DISPATCHED is not equivalent to an externally authorized economic action.

Current read-only audit:

- 5 execution packets are DISPATCHED.
- 0 expose packet-level `external_action_allowed = true` together with `authorization_verdict = allow`.
- 1 packet has an explicit prior worker block: `PACKET_NOT_AUTHORIZED_FOR_EXTERNAL_ACTION`.
- Several dispatched packets have no packet-level external authorization field at all.

Therefore:

DISPATCHED != LIVE_EXTERNAL_ACTION

The state machine currently has an orchestration-status gap between dispatch and genuine external authorization.

## Economic consequence

The worker can be technically alive while no legitimate external economic effect can occur.

This is now a narrower bottleneck than substrate admission:

DEMAND
-> AUTHORIZATION
-> EXTERNAL EFFECT
-> BUYER RESPONSE
-> PAYMENT
-> FULFILLMENT
-> VERIFIED REVENUE

The current evidence breaks at EXTERNAL EFFECT.

## Safety

This audit is read-only.

It does not:
- create a buyer
- create a contract
- submit an offer
- send a public message
- spend money
- mutate authorization
- mutate revenue
- mutate economic outcomes

## Verifier

Run from the repository root with read-only Supabase credentials:

python runtime/economic_dispatch_reality_audit.py

Exit code 0 means at least one packet is genuinely externally authorized.
Exit code 2 means zero packets currently satisfy both conditions.

Proof is diagnostic only and must not be interpreted as revenue evidence.
