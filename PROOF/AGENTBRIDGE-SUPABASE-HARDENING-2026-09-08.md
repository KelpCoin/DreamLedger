# AgentBridge Supabase hardening proof

Date: 2026-09-08
Repository: KelpCoin/DreamLedger
Branch: fix/agentbridge-grok-relay
Supabase project: wbwgroygjeyukkspnqiy

## Verified production changes

The production `public.control_bridge_notes` table now contains:

- `event_id text`
- `correlation_id text`

A database trigger named `trg_sync_control_bridge_event_keys` extracts those identifiers from `STRUCTURED_EVENT` JSON bodies.

Indexes verified:

- `idx_control_bridge_notes_type_created`
- `idx_control_bridge_notes_correlation_created`
- `uq_control_bridge_structured_event_id`

The unique index enforces one structured event per `event_id` at the database boundary.

## Bridge topology

The canonical agent relay remains:

`Grok -> DreamLedger AgentBridge -> Supabase control_bridge_notes`

Airtable and Notion are cockpit/presentation layers, not the transport or economic truth layer.

## Truth boundary

This hardening does not create or modify revenue truth. No payment was fabricated. No RA_000001 state was changed. The bridge remains separate from the Stripe Truth Pipe.

## Remaining evidence gate

An authenticated live Grok-to-production AgentBridge request has not been marked VERIFIED. That status requires an actual authenticated request and a captured proof artifact.
