-- DreamLedger canonical Neon additive pilot migration (staging first).
-- Financial history untouched. No fake inventory and no auto publication.
-- Auction bids are offers only; payments/settlement must be independently verified.

CREATE TABLE IF NOT EXISTS marketplace.auction_rules (
 listing_id uuid PRIMARY KEY REFERENCES marketplace.listings(id) ON DELETE RESTRICT,
 minimum_increment_minor bigint NOT NULL DEFAULT 100 CHECK (minimum_increment_minor > 0),
 reserve_price_minor bigint NOT NULL DEFAULT 0 CHECK (reserve_price_minor >= 0),
 closes_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','closed','settled','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace.auction_bids (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 listing_id uuid NOT NULL REFERENCES marketplace.auction_rules(listing_id) ON DELETE RESTRICT,
 bidder_principal_id text NOT NULL CHECK (length(bidder_principal_id) BETWEEN 3 AND 200),
 amount_minor bigint NOT NULL CHECK (amount_minor > 0),
 currency text NOT NULL CHECK (length(currency) = 3),
 idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 12 AND 200),
 status text NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted','voided')),
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auction_bids_highest_idx ON marketplace.auction_bids(listing_id, amount_minor DESC, created_at ASC) WHERE status='accepted';

CREATE TABLE IF NOT EXISTS marketplace.avatar_profiles (
 principal_id text NOT NULL CHECK (length(principal_id) BETWEEN 3 AND 200),
 silo_id text NOT NULL CHECK (length(silo_id) BETWEEN 2 AND 100 AND silo_id !~* '(adult|amplissa|mplusa)'),
 display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 60),
 colour_hex text NOT NULL CHECK (colour_hex ~ '^#[a-fA-F0-9]{6}$'),
 media_asset_key text,
 published boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (principal_id, silo_id)
);

CREATE TABLE IF NOT EXISTS marketplace.billboard_placements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_organization_id uuid NOT NULL REFERENCES marketplace.organizations(id) ON DELETE RESTRICT,
 silo_id text NOT NULL CHECK (length(silo_id) BETWEEN 2 AND 100 AND silo_id !~* '(adult|amplissa|mplusa)'),
 market_code text NOT NULL CHECK (market_code IN ('NZ','AU','ZA','EU','AMERICAS','GLOBAL')),
 units integer NOT NULL CHECK (units IN (1,2,10,25)),
 placement_title text NOT NULL CHECK (length(placement_title) BETWEEN 1 AND 120),
 destination_url text NOT NULL CHECK (length(destination_url) BETWEEN 8 AND 2048),
 moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending','rejected','approved_pending_payment','published','retired')),
 payment_verified boolean NOT NULL DEFAULT false,
 published_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (moderation_status <> 'published' OR (payment_verified AND published_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS billboard_placements_inventory_idx ON marketplace.billboard_placements(market_code, moderation_status);

CREATE OR REPLACE VIEW marketplace.auction_public AS
 SELECT l.id,l.silo_id,l.slug,l.title,l.description,l.category,l.price_minor,l.currency,
        a.minimum_increment_minor,a.reserve_price_minor,a.closes_at,
        COALESCE(b.high_bid_minor,0) AS current_bid_minor,COALESCE(b.bid_count,0) AS bid_count
 FROM marketplace.listings l
 JOIN marketplace.auction_rules a ON a.listing_id=l.id
 LEFT JOIN LATERAL (
   SELECT MAX(amount_minor) AS high_bid_minor, COUNT(*) AS bid_count
   FROM marketplace.auction_bids WHERE listing_id=l.id AND status='accepted'
 ) b ON true
 WHERE l.status='published' AND l.listing_type='auction' AND l.quantity>0
   AND a.status='live' AND a.closes_at>now();

CREATE OR REPLACE VIEW marketplace.billboard_public_inventory AS
 SELECT markets.code AS market_code, 100 AS capacity,
        COALESCE(sum(p.units) FILTER (WHERE p.moderation_status='published'),0)::integer AS published_units,
        (100-COALESCE(sum(p.units) FILTER (WHERE p.moderation_status='published'),0))::integer AS remaining_units
 FROM (VALUES ('NZ'),('AU'),('ZA'),('EU'),('AMERICAS'),('GLOBAL')) AS markets(code)
 LEFT JOIN marketplace.billboard_placements p ON p.market_code=markets.code
 GROUP BY markets.code;
