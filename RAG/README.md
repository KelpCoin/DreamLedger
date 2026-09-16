# DreamLedger Evidence RAG

RAG-001 is the retrieval layer for DreamLedger and BrownEye evidence. It is not a source of truth. Canonical repository state, Supabase control state, Stripe state, and signed proof artifacts remain authoritative.

## Architecture

GitHub / proof JSON / approved evidence -> chunk + hash -> Supabase `rag.documents` + `rag.chunks` -> keyword + pgvector hybrid retrieval -> evidence packet -> model.

Supabase hybrid retrieval uses PostgreSQL full-text search plus pgvector with reciprocal-rank fusion. This follows the current Supabase hybrid-search pattern.

## Required environment

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` for ingestion/query worker use only
- `GITHUB_TOKEN` when ingesting private repositories
- `RAG_GITHUB_REPOS` comma-separated `owner/repo` values
- `RAG_EMBEDDING_URL` optional OpenAI-compatible `/embeddings` endpoint
- `RAG_EMBEDDING_MODEL` optional model name
- `RAG_API_KEY` optional bearer key for the M2M RAG endpoint

If no embedding endpoint is configured, ingestion still records documents and chunks and hybrid search falls back to keyword retrieval.

## Commands

`npm run rag:ingest`

`npm run rag:query -- "What is the current verified commercial state of DreamLedger?"`

`npm run rag:eval`

## M2M endpoint

`POST /m2m/v1/rag/query`

Body:

```json
{"query":"What is the current verified commercial state of DreamLedger?","match_count":8}
```

The endpoint returns retrieved evidence with source URI, source path, SHA metadata and retrieval score. It does not generate an LLM answer and therefore cannot silently convert retrieval into truth.

## Security

The `rag` schema is not exposed to public clients. Service-role access is required. Do not place service-role keys in browser code or committed files.
