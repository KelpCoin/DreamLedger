-- Supabase is a SECONDARY evidence recovery target, not a live checkout primary.
-- The recovery copy is quarantined and cannot create orders or claim net revenue.
CREATE SCHEMA IF NOT EXISTS beck_reconciliation;
REVOKE ALL ON SCHEMA beck_reconciliation FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS beck_reconciliation.historical_receipt_backup (
 provider_account_id text NOT NULL CHECK (provider_account_id ~ '^acct_[A-Za-z0-9]+$'),
 payment_intent_id text NOT NULL CHECK (payment_intent_id ~ '^pi_[A-Za-z0-9]+$'),
 charge_id text NOT NULL CHECK (charge_id ~ '^ch_[A-Za-z0-9]+$'),
 amount_minor bigint NOT NULL CHECK (amount_minor > 0),
 currency text NOT NULL CHECK (currency ~ '^[a-z]{3}$'),
 attribution_status text NOT NULL DEFAULT 'UNATTRIBUTED' CHECK (attribution_status='UNATTRIBUTED'),
 payment_fulfillment_proven boolean NOT NULL DEFAULT false CHECK (payment_fulfillment_proven=false),
 source_branch text NOT NULL,
 recovered_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (provider_account_id,payment_intent_id),
 UNIQUE (provider_account_id,charge_id)
);
REVOKE ALL ON beck_reconciliation.historical_receipt_backup FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE beck_reconciliation.historical_receipt_backup IS
 'Secondary recovery copy only; never source of truth for payment, stock or customer fulfillment.';
