# Figure Eight cockpit

Cloud and local readiness are scored separately out of 1,000. Full points require fresh acceptance evidence; missing evidence is marked UNVERIFIED and earns no points. The cloud score covers database reliability (200), Stripe webhook routing (200), settled-payment-to-ledger reconciliation (200), paid-order-to-delivery proof (200), CI reliability (100), and backups/alerts/kill-switch proof (100).

The money panel reports Stripe balance-ledger charge movements for the New Zealand calendar day, gross and net, plus payout movements. These are not automatically DreamLedger revenue. Verified DreamLedger revenue stays at NZ$0 until independent buyer, attribution, settlement, fulfillment and delivery evidence reconcile.

Optional protected read-only probe URLs may be configured as repository secrets: `COCKPIT_DB_PROBE_URL` returns fresh JSON `checked_at`, `database_query_ok:true`, `read_only:true`; `COCKPIT_LEDGER_PROBE_URL` returns `checked_at`, `settlement_reconciled:true`, `mismatch_count:0`; `COCKPIT_FULFILLMENT_PROBE_URL` returns `checked_at`, `delivery_evidence_verified:true`, `stuck_paid_orders:0`, `unmatched_paid_orders:0`; `COCKPIT_RECOVERY_PROBE_URL` returns `checked_at`, `backup_restore_verified:true`, `alert_path_verified:true`, `kill_switch_tested:true`. All evidence must be less than 10 minutes old. Do not expose service-role keys or unrestricted diagnostic endpoints.

Discord reports are disabled by default. Enable only after configuring repository variable `COCKPIT_DISCORD_ENABLED=true` and secret `COCKPIT_DISCORD_WEBHOOK_URL` for a private channel. The sender enforces a minimum 15-minute staging delay and obeys `COCKPIT_KILL_SWITCH=true`; cancel the GitHub Actions run to stop a pending notification. Do not commit or share the webhook URL. This is one-way webhook reporting, not a slash-command bot. Interactive `/today` commands would require a separately authenticated Discord application and interaction endpoint.

Run locally with `node ops/cockpit/figure-eight-cockpit.mjs`. Optional local proof input: set `COCKPIT_LOCAL_PROOF_JSON` to a fresh local bootstrap receipt. A missing local receipt is shown as 0 verified points / UNOBSERVED, not proof that the PC is broken. The scripts make read-only GET requests and do not mutate Stripe, Supabase, Render, orders or fulfillment.


## Current cloud audit note (2026-10-12)

The live Stripe endpoint inventory showed the endpoint labelled canonical revenue settlement disabled, while several other live destinations remain enabled for overlapping checkout events. The Render destination `/api/webhooks/stripe` also did not match the `/webhook` route in the actual `BEC-PRIME/start.js` runtime. The current PR adds the configured path as an alias into the same existing dispatcher and adds a regression contract check. This code is **not deployed or live-verified** yet.

Do not enable the disabled revenue endpoint or disable existing endpoints until the database is demonstrably stable and one canonical destination passes signature verification, replay/idempotency, payment attribution, fulfillment, and delivery-proof tests. The current provisional evidence score is therefore low by design. No production webhook configuration has been changed.
