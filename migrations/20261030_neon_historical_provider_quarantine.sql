-- BECK historical provider evidence quarantine, Neon-first.
-- NOT a sales/order ledger; must never increment revenue or release fulfilment.
-- Applied only after human-reviewed source matching and on a nonproduction branch first.
BEGIN;
CREATE SCHEMA IF NOT EXISTS beck_reconciliation;
REVOKE ALL ON SCHEMA beck_reconciliation FROM PUBLIC;
CREATE TABLE IF NOT EXISTS beck_reconciliation.provider_receipts (
  provider text NOT NULL CHECK (provider = 'stripe'),
  provider_account_id text NOT NULL CHECK (provider_account_id ~ '^acct_[A-Za-z0-9]+$'),
  payment_intent_id text NOT NULL CHECK (payment_intent_id ~ '^pi_[A-Za-z0-9]+$'),
  charge_id text NOT NULL CHECK (charge_id ~ '^ch_[A-Za-z0-9]+$'),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  amount_received_minor bigint NOT NULL CHECK (amount_received_minor >= 0),
  currency text NOT NULL CHECK (currency ~ '^[a-z]{3}$'),
  payment_intent_status text NOT NULL,
  charge_status text NOT NULL,
  charge_paid boolean NOT NULL,
  charge_refunded boolean NOT NULL,
  amount_refunded_minor bigint NOT NULL CHECK (amount_refunded_minor >= 0),
  payment_intent_created_at timestamptz NOT NULL,
  charge_created_at timestamptz NOT NULL,
  source_verified_at timestamptz NOT NULL,
  attribution_status text NOT NULL DEFAULT 'UNATTRIBUTED'
    CHECK (attribution_status = 'UNATTRIBUTED'),
  independent_buyer_verified boolean NOT NULL DEFAULT false
    CHECK (independent_buyer_verified = false),
  paid_and_fulfilled_verified boolean NOT NULL DEFAULT false
    CHECK (paid_and_fulfilled_verified = false),
  inserted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_account_id, payment_intent_id),
  UNIQUE (provider, provider_account_id, charge_id),
  CHECK (amount_refunded_minor <= amount_minor)
);
REVOKE ALL ON beck_reconciliation.provider_receipts FROM PUBLIC;
REVOKE ALL ON beck_reconciliation.provider_receipts FROM dreamledger_app;
COMMENT ON TABLE beck_reconciliation.provider_receipts IS
 'Quarantined historical Stripe snapshots. No buyer attribution, external revenue or fulfilment established. Not accessible to application role.';
COMMIT;
