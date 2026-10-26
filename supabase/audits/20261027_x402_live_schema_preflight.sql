-- Read-only schema preflight. Run on production BEFORE applying migration or merging x402 PR.
-- Do not accept a matching repository migration as proof of production state.
WITH required(rel,col,kind) AS (
  VALUES
    ('economic_events','event_id','identity'),
    ('economic_events','source_system','x402_attribution'),
    ('economic_events','source_record_id','x402_attribution'),
    ('economic_events','metadata','jsonb'),
    ('economic_events','verification_status','truth'),
    ('economic_events','payment_settled','payment_state'),
    ('economic_events','delivery_verified','delivery_state'),
    ('economic_events','artifact_sha256','artifact_hash'),
    ('x402_settlements','idempotency_key','idempotency'),
    ('x402_settlements','amount_atomics','exact_amount'),
    ('x402_settlements','tx_hash','chain_evidence'),
    ('agent_toll_calls','call_id','order_binding'),
    ('agent_toll_calls','result_hash','result_evidence'),
    ('runtime_proofs','artifact_hash','original_proof'),
    ('runtime_proofs','source_reference','original_proof'),
    ('fulfillment_requests','payload','existing_delivery_contract')
)
SELECT r.rel AS table_name, r.col AS column_name, r.kind,
  CASE WHEN c.column_name IS NULL THEN 'ABSENT' ELSE 'PRESENT' END AS state,
  c.data_type AS observed_type, c.is_nullable
FROM required r
LEFT JOIN information_schema.columns c
  ON c.table_schema='public' AND c.table_name=r.rel AND c.column_name=r.col
ORDER BY r.rel,r.col;

-- Additional inspection: determine if the existing x402 scoreboard is based on
-- metadata, a database view, or a materialised table before touching live claims.
SELECT c.table_name,c.column_name,c.data_type
FROM information_schema.columns c
WHERE c.table_schema='public'
 AND (c.column_name ILIKE '%artifact%'
      OR c.column_name ILIKE '%delivery%'
      OR c.column_name ILIKE '%fulfil%'
      OR c.column_name ILIKE '%scoreboard%'
      OR c.column_name ILIKE '%settle%')
ORDER BY c.table_name,c.column_name;
