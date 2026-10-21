# Provider exit: operational state and safe source backup

The canonical migration work is tracked in [PR #777](https://github.com/KelpCoin/DreamLedger/pull/777) on branch beck/provider-migration-neon-cloudflare-20261019. The target is Cloudflare Pages/Workers + Neon, preserving MTG silo boundaries and the evidence-gated economic contract. Do not create an alternate migration branch or claim the providers are replaced until the acceptance gates pass.

## Current observed status (2026-10-21)

- Production public routes /, /mtg/, /catalog.json, /data/mtg-catalog.json, and /healthz returned HTTP 503 during a read-only external probe.
- Supabase control plane reported project wbwgroygjeyukkspnqiy as ACTIVE_HEALTHY, but direct SQL and migration-list calls failed with ECONNREFUSED. No source dump has been created or verified.
- The linked Neon account returned no projects. No target database has been provisioned or imported.
- The Cloudflare preview deployment is blocked until the owner privately configures the required GitHub Actions values and a Pages preview deployment is actually observed. Do not paste credentials into chat or source control.
- The connected Stripe integration could not identify an eligible linked account, so remote deactivation of the Commander Diagnostic Payment Link is unconfirmed. Its price/link has been removed from the public catalogue and economic-pulse surfaces; the landing page now states that purchases are held.
- The Provider migration static safety contract completed PASS in GitHub Actions run 39520681150; the preview builder validated the non-production 409-asset bundle and held catalogue state. This is not a production deployment or route-acceptance pass.
- Verified external revenue remains NZ$0.00.

## Make a private source backup before import

1. Install PostgreSQL client tools (psql, pg_dump, pg_restore) on the Windows migration machine.
2. From the repository root, run:

   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\ops\migration\supabase-to-neon\Export-Supabase-ForensicBackup.ps1

3. The script prompts for the source host, database, username, port and hidden password when not already set in this PowerShell process. Use the exact connection details from the Supabase dashboard. If the direct database host is unreachable, try the Supabase Session Pooler connection details and port shown in the dashboard.
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
