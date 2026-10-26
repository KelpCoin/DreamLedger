# Existing BECK x402 settlement and delivery gate

The current DreamLedger Supabase project's management API reports ACTIVE_HEALTHY,
but direct production SQL metadata queries failed with ECONNREFUSED on port 5432.
The recovery database is **not** the production financial ledger.

## Order of execution
1. Run `supabase/audits/20261027_x402_live_schema_preflight.sql` against the
   original production database using an authorised read-only connection.
   Save its exact result as a non-secret CI/release artifact.
2. Compare data types, policies and historical x402 rows against the migration.
   Never overwrite historic verification or financial records.
3. Deploy the additive schema migration only after its preconditions pass.
4. Deploy both original Edge Functions together (agent-toll-road and x402-reconcile)
   and the existing quote-fulfillment worker if its hash enhancement is approved.
5. Complete Base Sepolia end-to-end evidence before enabling any mainnet rail.
6. For independent revenue, require external buyer attribution, confirmed onchain
   transfer, exact quote result hash, proof of buyer delivery, and a verified gate.
7. Separate Coinbase Base USDC (eip155:8453) from OKX A2MCP X Layer USDt0
   (eip155:196). These routes cannot be registered interchangeably.

## Proof contract
- `economic_events.payment_settled`: true only after independent chain confirmation
- `economic_events.delivery_verified`: true only after the delivered bytes were
  independently checked against `artifact_sha256` and delivery evidenced
- `economic_events.artifact_sha256`: lowercase hex SHA-256 of exact artifact bytes,
  without 0x prefix, or NULL until evidence is available
- `economic_events.metadata.scoreboard_eligible`: never true until settlement,
  independent buyer status, fulfilment and external delivery are verified
- `runtime_proofs.artifact_hash`: **existing hash**, not automatically the
  downloadable CSV's byte-level hash. Must not be silently substituted.
- `fulfillment_requests.payload.delivery.csv_sha256`: SHA-256 of the uploaded
  CSV byte sequence; `evidence_status=UNVERIFIED` until delivery is verified.

A facilitator's success response is not the same as an independently reconciled
transaction. A hash is not proof of successful client receipt. A testnet payment
is not verified economic revenue.

No new architecture; this change extends the existing SQL and Edge Functions.
