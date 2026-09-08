# Demand Radar

Read-only demand ingestion for BrownEye/DreamLedger.

Current collector:
- n8n Community Jobs JSON endpoint
- No posting, bidding, messaging, or other external action
- Signals are written to Supabase economic_demand_signals
- Duplicate source URLs are prevented by a database unique index
- All resulting routes remain approval-gated

Required GitHub Actions secrets:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

The service-role key is used only inside the GitHub Actions runtime and is never committed.
