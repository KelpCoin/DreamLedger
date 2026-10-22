# Provider exit: operational state and safe source backup

The canonical migration work is tracked in [PR #777](https://github.com/KelpCoin/DreamLedger/pull/777) on branch beck/provider-migration-neon-cloudflare-20261019. The target is Cloudflare Pages/Workers + Neon, preserving MTG silo boundaries and the evidence-gated economic contract. Do not create an alternate migration branch or claim the providers are replaced until the acceptance gates pass.

## Current observed status (2026-10-22)

- **G08 dispatcher registration prerequisite is complete:** PR #805 was merged to `main` at commit `c4fca15adc36bd382b666dd15816f6c5461a971d`; the preview workflow now exists on the default branch. Deployment is still BLOCKED until its three private Cloudflare Actions secrets are configured and the operator dispatches against `beck/provider-migration-neon-cloudflare-20261019` with input `approval_marker=[approve-cloudflare-preview]`. Only a real immutable pages.dev URL + exact tested SHA + successful route-probe artifact can prove G08.
- **GitHub Pages source hazard:** the native `pages build and deployment` workflow was triggered by the `main` merge SHA despite a `[skip ci]` merge commit. [Run 39702416853](https://github.com/KelpCoin/DreamLedger/actions/runs/39702416853) completed deployment successfully. Therefore `[skip ci]` is not adequate protection for native Pages publishing; audit the repository Pages source before more `main` pushes. No DNS mutation was authorized.
- **Public site:** `/`, `/mtg/`, `/healthz`, `/data/mtg-catalog.json` each returned HTTP 503 in read-only probes on 2026-10-22 (these routes were also observed at 503 before the merge). Production is not verified operational.
- **G02/G06 source data:** Supabase DreamLedger `wbwgroygjeyukkspnqiy` is `ACTIVE_HEALTHY` at the control plane, but the SQL data plane fails with `ECONNREFUSED 2406:da18:1691:a200::3484:5432`. No verified complete source dump or source import exists; do not equate the 66-function source inventory with a database schema inventory.
- **Neon staging now exists:** project `falling-base-50259456` (`dreamledger-migration-staging`, AWS Sydney). It has 11 staging application tables, all verified empty on 2026-10-22, including commercial orders/payments/evidence and agent-market jobs/receipts. This is a scaffold only; source row parity is not proven.
- **Source backup fallback:** Direct Supabase database endpoints are IPv6 by default. If the direct endpoint is unreachable, use the project's exact session-pooler IPv4 host, port 5432 and `postgres.<project-ref>` username obtained privately from Supabase Connect. Never invent a pooler host. See `Export-Supabase-ForensicBackup.ps1`, which is source-read-only and stores dumps locally without committing them.
- **G16/G17 exits:** NOT_RUN. Render and Supabase are not retired. Production route parity, auth, storage, payment settlement, durable fulfillment, rollback and soak acceptance are NOT PROVEN. Verified externally fulfilled revenue remains NZD 0.00.

## Make a private source backup before import

1. Install PostgreSQL client tools (psql, pg_dump, pg_restore) on the Windows migration machine.
2. From the repository root, run:

   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\ops\migration\supabase-to-neon\Export-Supabase-ForensicBackup.ps1

3. The script prompts for the source host, database, username, port and hidden password when not already set in this PowerShell process. Use the exact connection details from the Supabase dashboard. If the IPv6 direct database host is unreachable, use the *exact* Supabase Session Pooler host and username shown in the project's Connect panel (usually port 5432), without guessing endpoint names.
4. The script writes a private folder under D:\BrownEyeCortex\Proof\DreamLedger-Migration (with a LocalAppData fallback) containing:
   - read-only all-schema dependency inventory;
   - custom-format full database dump;
   - schema-only SQL dump;
   - pg_restore --list validation;
   - per-file SHA-256 hashes and a manifest.
5. Keep these files private. Do not upload database dumps or inventory output into GitHub. The export script does not import to Neon and does not mutate the Supabase source. A failed connection fails closed.

The inventory covers custom schemas, relations, columns, sequences, types, extensions, indexes, constraints, triggers, RLS policies, grants and routine/dependency metadata. It cannot alone prove Storage object bytes, all Auth identity migration requirements, Edge Functions, scheduled tasks or Realtime parity. Those remain separate gates in ops/migration/FREE-EXIT-CHECKLIST.json.

## Release order

1. Source backup succeeds; dependency inventory is reviewed and dump scope is decided.
2. Cloudflare preview deploys with the expected commit SHA and live route smoke passes. Preview currently disables unported payment/webhook/stateful APIs with explicit 503, which is the safe behavior.
3. Neon schema and repository adapter cover the actual application state model, not only the minimal heartbeat/commercial schema. Test transactions, unique Stripe-event claims, idempotent outbox, read/write/read-back, backup and restore on test data.
4. All Render runtime endpoints are ported or explicitly retired, and the relevant route, auth, quota, file-storage, webhooks and fulfillment checks pass.
5. Remote Stripe Payment Link deactivation is confirmed for held offers; test-mode checkout, signed webhook, settlement, attribution, fulfillment and delivery receipt reconciliation pass.
6. Owner approves DNS cutover with rollback evidence. Only after stable production acceptance and read/write parity should Render services be removed and the Supabase project paused or decommissioned.

Never treat HTTP 200 alone, a preview build, a checkout start, a simulated payment, or a repository row as verified revenue. Until the applicable gates pass, the status remains NOT_RUN / migration in progress.
