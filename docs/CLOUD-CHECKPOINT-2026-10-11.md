# DreamLedger Cloud Checkpoint — 2026-10-11

## Purpose
Durable handoff of the current DreamLedger state, decisions, verified evidence, blockers, and next actions. This is a snapshot, not a claim that the entire system is healthy or enterprise-certified.

## Canonical truth rules
- Verified revenue remains NZ$0.00 until an independent buyer pays, the payment settles externally, fulfillment completes, and delivery evidence is retained.
- PaymentIntent, Checkout Session, Payment Link, code, internal database rows, or a success-page view alone are not revenue.
- Required chain: REAL DEMAND → REAL BUYER → AUTHORIZED ACTION → EXTERNAL RESULT → SETTLED PAYMENT → FULFILLMENT → DELIVERY/EVIDENCE → VERIFIED.
- Unknown is not pass. Do not write to production Supabase while recovery is unverified.
- No production purchases, production DB writes, live Stripe setting changes, or production deployments were made as part of this checkpoint.

## Cloud persistence map
- GitHub: versioned source, tests, workflow runs, PRs, and this checkpoint artifact.
- Notion: human-readable doctrine, master silo reference, and computer pickup/handoff.
- Airtable: operational work queue and status tracking.
- Supabase: intended transactional application system of record, but prior WAL/disk-full and connection errors mean production persistence/recovery is NOT VERIFIED.
- These services are complementary, not substitutes for one another. This checkpoint does not establish a tested independent backup/restore.

## Current MTG clone-readiness work
- PR #635: https://github.com/KelpCoin/DreamLedger/pull/635
- Branch: audit/mtg-clone-readiness-2026-10-11
- Latest relevant commit: 2ce307bf7ad3a4a26186b57e0566a134a9beb2ec
- Scope: Edward Kenway public catalogue price corrected to NZ$400; Node built-in catalogue safety tests added; MTG catalogue safety workflow added; MTG diagnostic fulfillment workflow assertions corrected; clone-readiness documentation added.
- Commit workflow run query for that SHA returned:
  - MTG Diagnostic Fulfillment Gate: PASS, run 38104003730.
  - MTG catalogue safety gate: PASS, run 38104003564.
  - MTG catalogue validation: PASS, run 38104003743.
  - Several additional checks passed.
  - Multiple unrelated workflows FAILED, including DreamMeez Public Surface Gate, Phin Haven Gauntlet, Browning Economic Gate, Cortex CI/CD Live Release Gate, Forensic BEC Compiler Run, and wealth-engine-verify.
- Therefore: selected MTG gates pass, but the repository is NOT globally green. Verify each run's exact head SHA and PR status before merge/release.
- PR is not merged and this checkpoint is not a deployment.

## Commerce truth and offers
- Commander Diagnostic: NZ$29 Stripe Payment Link exists; metadata/catalog consistency was previously assessed as aligned. Still needs proof of public offer → checkout → paid webhook → fulfillment → delivery evidence.
- Billboard: NZ$50 Payment Link exists, but Payment Link metadata SKU DL-BILLBOARD-100X100-3000-001 differs from public catalog SKU DREAMLEDGER-BILLBOARD-FOUNDING-001. Reconcile before trusting attribution.
- Edward Kenway deck: NZ$400 Payment Link exists; Payment Link metadata SKU EDH_0001 differs from public catalog SKU EDH-EDWARD-KENWAY-PACIN-ON-THE-PLANK-001. Reconcile before trusting attribution.
- Prior Stripe audit found successful PaymentIntents with empty metadata that were UNMATCHED/UNVERIFIED, and older webhook routing/handler risks. Do not count those as verified revenue.
- Webhook idempotency must be tested with redelivery of the SAME signed event ID; separately generated test events do not prove duplicate-event idempotency.
- No verified independent buyer, no verified paid fulfilled order, and no verified outcome is currently established in this checkpoint.

## Supabase and data safety
- Project: wbwgroygjeyukkspnqiy, region ap-southeast-1.
- Prior failures included WAL/disk full / “No space left on device”, SQLSTATE 53100 / 57P03, PGRST000/PGRST002, and ECONNREFUSED, despite a healthy-looking dashboard.
- Treat production database health as UNVERIFIED until a successful read, a safe controlled write/read-back where authorized, and recovery evidence are obtained.
- No blind production writes. Obtain provider recovery confirmation; validate connectivity; inspect migration state and RLS; then perform a controlled persistence test.
- RLS had previously been reported disabled on pre_registrations, evidence_graph_edges, gauntlet_certificates, and gauntlet_policy_registry. Re-check actual current state and apply least-privilege policies deliberately.
- Target future design: Supabase primary + independent warm standby with controlled promotion + encrypted off-provider backups. No active-active and no split brain. A backup is only proven after a restore test.

## Architecture and storage roles
- Notion = readable operating doctrine/master reference.
- Airtable = operational queue and status cockpit.
- GitHub = source-controlled implementation and reproducible checks.
- Supabase = transactional runtime/system of record after recovery.
- Do not migrate the entire master specification into Supabase merely to make it “more canonical”. Give each fact one authoritative home and link derived views.
- One silo → one CTA → one commercial wall. CUBE remains internal.
- Freeze architecture expansion and finish one safe transaction path before cloning broadly.

## Next actions in order
1. Confirm Supabase provider recovery and connectivity; no production writes before this gate.
2. Verify PR #635 current head SHA, merge status, and the exact SHA for each required workflow run. Investigate failing required checks rather than declaring global green.
3. Verify live Commander Diagnostic page and checkout price/currency; ensure SKU and catalog mapping are consistent.
4. Verify signed webhook handling, paid-status checks, amount/currency/catalog match, duplicate same-event idempotency, and retryable fulfillment.
5. Complete one authorized end-to-end transaction in an appropriate controlled environment; for production, only with explicit authorization. Retain Stripe settlement evidence, fulfillment result, and delivery evidence.
6. Reconcile Billboard and Edward SKU mismatches.
7. Test independent backup and restore; then revisit clone certification.
8. Only after the master passes: create a clean non-production clone with isolated IDs, secrets, payment configuration, tenant data, and passing acceptance tests.

## Honest status
- Code/documentation persistence: partially verified via GitHub PR/branch and existing cloud workspace records.
- Notion/Airtable handoff: prior writes were completed; the latest status is recorded here.
- Supabase production persistence/recovery: UNVERIFIED.
- Repository-wide CI: NOT GREEN.
- Enterprise-grade clone certification: NOT PASSED.
- Verified revenue: NZ$0.00.
- Closest money route: make the NZ$29 Commander Diagnostic path genuinely work end-to-end, then acquire an independent buyer through inbound discovery. Do not wait for all of DreamLedger to be perfect.
