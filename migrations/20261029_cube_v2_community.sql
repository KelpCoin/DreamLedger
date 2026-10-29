CREATE TABLE IF NOT EXISTS marketplace.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  silo_id text NOT NULL REFERENCES marketplace.silo_contracts(silo_id),
  kind text NOT NULL CHECK (kind IN ('discussion','question','meetup','announcement','listing_interest')),
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 180),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','removed')),
  public_alias text,
  moderation_receipt_sha256 text,
  moderated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cube_community_publication_gate CHECK (
    status <> 'published' OR (
      moderation_receipt_sha256 ~ '^[a-f0-9]{64}$'
      AND moderated_at IS NOT NULL AND published_at IS NOT NULL
    )
  )
);
CREATE INDEX IF NOT EXISTS cube_community_public_silo
ON marketplace.community_posts(silo_id, published_at DESC)
WHERE status='published';
REVOKE ALL ON marketplace.community_posts FROM PUBLIC;
COMMENT ON TABLE marketplace.community_posts IS
'Community records are isolated by silo and are only published with moderation evidence.';
