-- Keep the canonical AgentBridge event type accepted by the durable relay table.
-- Idempotent constraint replacement for production drift.

alter table public.control_bridge_notes drop constraint if exists control_bridge_notes_note_type_check;

alter table public.control_bridge_notes
  add constraint control_bridge_notes_note_type_check
  check (note_type = any (array[
    'HANDOFF'::text,
    'QUESTION'::text,
    'FINDING'::text,
    'WARNING'::text,
    'DECISION'::text,
    'LOVE_NOTE'::text,
    'STRUCTURED_EVENT'::text
  ]));
