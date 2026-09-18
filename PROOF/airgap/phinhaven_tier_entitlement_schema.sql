-- PHINHAVEN tier entitlement schema (design sketch)
-- Air-gapped / offline review only. Not applied by the commit that introduces this file.
-- Cosmetics and titles only. No combat power. No currency mint.

CREATE TABLE IF NOT EXISTS public.phinhaven_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  tier_key text NOT NULL CHECK (tier_key IN ('free', 'supporter', 'founder', 'haven_keeper')),
  source text NOT NULL CHECK (source IN ('patreon', 'discord', 'stripe', 'manual', 'test')),
  external_ref text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  cosmetic_ids text[] NOT NULL DEFAULT '{}',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (player_id, tier_key, source)
);

CREATE INDEX IF NOT EXISTS idx_phinhaven_entitlements_player
  ON public.phinhaven_entitlements (player_id);

-- Optional: map Discord role IDs in app config, not in this table.
-- Idempotency: callers must key on (source, external_ref) before insert.
