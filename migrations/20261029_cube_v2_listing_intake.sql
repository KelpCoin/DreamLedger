-- CUBE generic listing intake. Private, silo-scoped, never publishes automatically.
CREATE TABLE IF NOT EXISTS marketplace.silo_listing_intake (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  silo_id text NOT NULL REFERENCES marketplace.silo_contracts(silo_id),
  submitter_principal_id text NOT NULL CHECK (length(submitter_principal_id) BETWEEN 6 AND 128),
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9_-]{16,128}$'),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  listing_kind text NOT NULL CHECK (listing_kind IN ('physical','digital','service')),
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 180),
  description text NOT NULL CHECK (length(description) BETWEEN 1 AND 5000),
  price_minor bigint NOT NULL CHECK (price_minor BETWEEN 0 AND 100000000000),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 10000),
  fulfillment_mode text NOT NULL CHECK (fulfillment_mode IN ('shipping','pickup','digital','service')),
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  photo_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','review','approved','rejected','quarantined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (silo_id,submitter_principal_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS cube_silo_intake_queue
 ON marketplace.silo_listing_intake(silo_id,status,created_at);
REVOKE ALL ON marketplace.silo_listing_intake FROM PUBLIC;
COMMENT ON TABLE marketplace.silo_listing_intake IS
 'Never public: generic per-silo listing candidates. Approval and supply verification happen in separate workflows.';
