# DreamLedger Shared Knowledge Lake

Status: ACTIVE FOUNDATION

## Purpose

One shared knowledge substrate for DreamLedger workers and LLM sessions.

Cloud is the durable full-history archive. A computer keeps a durable local recent window for fast/offline reads. The local window is a cache/read accelerator, not a second competing truth.

## Canonical layers

- Economic settlement truth: Stripe.
- Transaction/application truth: Supabase.
- Shared knowledge truth: `public.knowledge_fossils`.
- Local read accelerator: `C:\DreamLedger_Actual\knowledge-lake\`.
- Human-readable projections: GitHub, Notion, Airtable.

## Write rule

Workers do not dump raw transcripts.

They publish distilled fossils:

- finding
- decision
- dead end
- open question
- evidence
- contradiction
- procedure

Each fossil has a stable claim key, contributor, provenance, timestamp, status, visibility, and content hash.

Conflicting claims remain separate. The system does not silently overwrite one claim with another.

## Sync rule

Phone/cloud worker:
cloud -> append fossil -> return fossil_id

PC worker:
local -> append fossil -> sync to cloud -> record receipt

Cloud -> local:
pull fossils missing from the local manifest by content hash/fossil_id.

The cloud archive is the superset. Local loss is recoverable.

## North Star invariant

Every action writes evidence.
Every piece of evidence is independently reproducible.
Knowledge compounds without Biggie in the loop.
No claim of economic outcome survives without independent external settlement.

## Current canonical MTG reference

`MTG_MASTER_SILO_V1` is registered in `agent_memory` and mirrored here as a knowledge fossil.

## Embeddings

Do not force an embedding model into the foundation yet. The first retrieval layer is deterministic metadata + full-text search. pgvector can be added once one embedding model is selected and used consistently across the lake.
