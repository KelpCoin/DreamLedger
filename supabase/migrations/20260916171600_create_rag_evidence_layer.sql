create extension if not exists vector with schema extensions;
create schema if not exists rag;

create table if not exists rag.documents (
  id uuid primary key default gen_random_uuid(), source_system text not null, source_type text not null,
  source_uri text not null, source_path text, source_sha256 text, observed_at timestamptz not null default now(),
  title text, content text not null, metadata jsonb not null default '{}'::jsonb, content_sha256 text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','STALE','REVOKED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(source_system, source_uri, content_sha256)
);
create table if not exists rag.chunks (
  id uuid primary key default gen_random_uuid(), document_id uuid not null references rag.documents(id) on delete cascade,
  chunk_index integer not null, content text not null, content_sha256 text not null, token_estimate integer,
  embedding extensions.vector(384), metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  unique(document_id, chunk_index), unique(document_id, content_sha256)
);
create table if not exists rag.retrieval_events (
  id uuid primary key default gen_random_uuid(), query_text text not null, retrieved_chunk_ids uuid[] not null default '{}',
  retrieval_method text not null, result_count integer not null default 0, latency_ms integer, caller text, created_at timestamptz not null default now()
);
create table if not exists rag.eval_cases (
  id uuid primary key default gen_random_uuid(), case_id text not null unique, query_text text not null,
  expected_source_uris text[] not null default '{}', expected_claims text[] not null default '{}', active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists rag_documents_content_fts_idx on rag.documents using gin(to_tsvector('english', coalesce(title,'') || ' ' || content));
create index if not exists rag_chunks_embedding_hnsw_idx on rag.chunks using hnsw (embedding vector_cosine_ops) where embedding is not null;
create index if not exists rag_chunks_document_idx on rag.chunks(document_id, chunk_index);
create index if not exists rag_documents_source_idx on rag.documents(source_system, source_type, status);
create or replace function rag.hybrid_search(query_text text, query_embedding extensions.vector(384) default null, match_count integer default 12, rrf_k integer default 50)
returns table (id uuid, document_id uuid, content text, source_uri text, source_path text, source_sha256 text, content_sha256 text, title text, metadata jsonb, score double precision)
language sql stable set search_path = pg_catalog, public, extensions, rag
as $$
with keyword as (
  select c.id, row_number() over(order by ts_rank_cd(to_tsvector('english', coalesce(d.title,'') || ' ' || d.content), websearch_to_tsquery('english', query_text)) desc) rank_ix
  from rag.chunks c join rag.documents d on d.id=c.document_id
  where d.status='ACTIVE' and to_tsvector('english', coalesce(d.title,'') || ' ' || d.content) @@ websearch_to_tsquery('english', query_text)
  order by rank_ix limit least(greatest(match_count,1)*3,100)
), semantic as (
  select c.id, row_number() over(order by c.embedding <=> query_embedding) rank_ix
  from rag.chunks c join rag.documents d on d.id=c.document_id
  where d.status='ACTIVE' and query_embedding is not null and c.embedding is not null
  order by c.embedding <=> query_embedding limit least(greatest(match_count,1)*3,100)
), fused as (
  select coalesce(k.id,s.id) id, coalesce(1.0/(rrf_k+k.rank_ix),0.0)+coalesce(1.0/(rrf_k+s.rank_ix),0.0) score
  from keyword k full outer join semantic s on s.id=k.id
)
select c.id,d.id,c.content,d.source_uri,d.source_path,d.source_sha256,c.content_sha256,d.title,c.metadata,f.score
from fused f join rag.chunks c on c.id=f.id join rag.documents d on d.id=c.document_id
order by f.score desc limit greatest(match_count,1);
$$;
grant usage on schema rag to service_role;
grant select,insert,update,delete on all tables in schema rag to service_role;
grant execute on function rag.hybrid_search(text, extensions.vector, integer, integer) to service_role;
