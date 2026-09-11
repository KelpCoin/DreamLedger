# Persistent Memory Schema

Live machine-readable memory is stored in Supabase `public.agent_memory`.

Columns:
- memory_id: UUID primary key
- memory_key: stable unique key
- silo_id: isolation boundary
- memory_type: CANON, STATE, DECISION, HANDOFF, RUNBOOK, EVIDENCE, LESSON, TASK, CONSTRAINT
- title: concise human-readable title
- content: durable content
- source_ref: provenance reference
- evidence_tier: explicit evidence level
- canonical: whether this record is a durable canonical instruction/state
- approval_required: whether a human must approve the associated action
- status: ACTIVE, SUPERSEDED, QUARANTINED, ARCHIVED
- supersedes_memory_id: optional prior memory record
- content_sha256: optional content fingerprint
- metadata: structured auxiliary data
- created_at / updated_at: timestamps

## Read policy

Agents with Supabase access should query this table before acting on prior context. Prefer `canonical=true` records for durable rules and the newest ACTIVE STATE records for current conditions.

## Write policy

Write a new record for material discoveries and decisions. Do not silently overwrite historical truth. If a state changes, mark the prior state SUPERSEDED where appropriate and create a new record with fresh evidence.

## Security

Never put API keys, service-role keys, bridge tokens, passwords, private credentials, or other secrets in this table or GitHub. Store only secret references and operational metadata.
