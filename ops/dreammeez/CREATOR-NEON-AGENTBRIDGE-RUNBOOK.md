# BECK Creator Studio: Peggy -> Agent Bridge -> Neon -> Elohim/Gauntlet

Canonical architecture: DreamLedger's EXISTING Vercel /api/[...route] HTTP dispatcher is the Agent Bridge entrypoint. **Neon is the sole writable primary** for the private avatar draft intake. Supabase is not on this path; do not silently fall back across databases. Neither checkout nor the public avatar registry are touched.

Private creator page (once approved and deployed): /creator-studio.html
API:
  POST /api/agent-bridge/cosmetics/submit
  GET  /api/agent-bridge/cosmetics/mine
  GET  /api/agent-bridge/cosmetics/image?id=ASSET-PEGGY-...

A creator-specific Bearer credential is required. The legacy
x-dreamledger-agent-token is NOT sufficient. Peggy's credential lives only as
SHA-256 in the Vercel secret BECK_CREATOR_PEGGY_TOKEN_SHA256, never in source
control. Generate a long random key using a trusted secret generator, privately
deliver it to Peggy, and provision the hash in the cloud. It is not stored in
localStorage and must not be sent to assistants or included in logs.

Deployment gates:
1. Confirm source data and live commerce still run safely; DO NOT switch
   payment services or delete the Supabase source DB while full recovery and
   reconciliation remain unverified. PR #877 covers separate Neon money loop.
2. Review the candidate SQL ops/dreammeez/neon_creator_intake.sql. Install it
   **only into the verified Neon primary** after PostgreSQL CI success and
   least-privilege review. Run it as a reviewed migration.
3. Create a dedicated DB role with SELECT and INSERT on the private drafts
   table and EXECUTE on the submit function only. Do NOT use neondb_owner or
   grant public SELECT, UPDATE, DELETE or commercial capabilities to the
   intake endpoint. Provision a scoped TLS-required URL as
   BECK_NEON_CREATOR_DATABASE_URL on Vercel. The function is SECURITY INVOKER.
4. Set BECK_CREATOR_PEGGY_TOKEN_SHA256 and, optionally,
   BECK_CREATOR_ALLOWED_ORIGINS (https://dreamledger.org,
   https://www.dreamledger.org). Never reuse the machine Agent Bridge token.
5. Vercel has git.deploymentEnabled=false in vercel.json. A merge does not
   automatically prove deployment; verify the actual production build commit
   and API behavior before giving Peggy a link.
6. Test genuine Peggy phone upload with PNG/WebP/JPEG <=1.2MB. Check one
   private draft row, SHA-256 source bytes, no public file, no sale, duplicate
   upload idempotency, and the authenticated image preview. Confirm isolated
   silo ID SILO_AVATAR and two target states PENDING.
7. Elohim and Gauntlet should consume only authenticated/validated candidate
   metadata and create reviewed render targets through the existing master
   avatar asset pattern; **do not** treat draft ingestion as an automatic
   publication, Stripe sale or verified render. An explicit owner publication
   approval is required before the canonical shared registry is changed.

Security: strict rights acknowledgment, per-creator token, browser origin
allowlist, content magic checks, upload byte limit, filename validation,
idempotent SHA-derived draft IDs, 100 draft / 50MB aggregate quota, database
PUBLIC privilege revoked and immutable DRAFT/approval-required lifecycle.
Original source images are private; only creator-authenticated image retrieval
is supported. The endpoint returns HOLD when Neon is unreachable and does not
misroute data to broken Supabase.

No user or production artwork, price, payment, entitlement, adult branding,
MTG inventory, public post or cloud database was changed by this draft PR.
Status: review/CI candidate only; not deployed or provisioned.
