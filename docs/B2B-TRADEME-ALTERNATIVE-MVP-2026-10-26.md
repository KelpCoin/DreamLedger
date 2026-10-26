# DreamLedger B2B marketplace MVP: implementation and release evidence

**Checked:** 2026-10-26 UTC  
**Scope:** Free B2B discovery/RFQ alternative, not a claim of full Trade Me feature parity.

## Implemented in source

- Public supplier-listing read API: returns only listings with `status='published'` and positive quantity.
- Public RFQ read API: returns only RFQs with `status='open'` and `visibility='marketplace'`.
- Public RFQ intake API: validates category, email, company, requirement details, region and explicit contact consent; uses an idempotency key; applies a five-request-per-IP-hash hourly limit; writes private intake records to Neon.
- Private RFQ inbox: bearer-token authentication, no-index page, no browser token persistence, text-only rendering, and CSV export with formula-injection neutralization.
- Browser-local quote comparison remains available without sending supplier quote data to the server.
- Neon migration creates 11 marketplace tables and enables RLS on all 11. Tenant read/insert policies are present for the main marketplace entities, including orders and audit events.
- The production release contract was changed from the held legacy Commander diagnostic to the B2B procurement surface.
- Vercel Git deployments are enabled in `vercel.json`; explicit rewrites route `/b2b` and `/marketplace` to their static pages.

## Verification evidence

- GitHub Actions `b2b-marketplace-validation` passed on commit `55fe53e7ea0db85c4c26622bf942ea1ac1cce030`: marketplace validator, JavaScript syntax checks, quote-comparator unit tests and RFQ adapter tests all passed.
- GitHub Actions `DreamLedger E-Commerce Smoke` passed on an earlier branch commit after the homepage-contract fixes.
- The migration was prepared on a temporary Neon branch, checked for 11/11 RLS-enabled tables and policy presence, then applied to the Neon project `dreamledger-migration-staging` default branch. No legacy financial tables were migrated or modified by this marketplace-only schema.
- New CI verifier: `scripts/validate-vercel-b2b-api.cjs`. It writes `PROOF-B2B-VERCEL-MVP.json` when run.

## Release blockers that remain real

1. The Vercel project environment write returned HTTP 404, `Project not found`, for the existing project. Therefore `NEON_DATABASE_URL`, `B2B_ADMIN_TOKEN`, and `RATE_LIMIT_SALT` have **not** been configured in Vercel.
2. The Vercel deployment API returned HTTP 403, `You don't have permission to create a Production Deployment`. The new source has not been independently verified as live.
3. DNS remains unchanged. The registrar's authoritative A/CNAME records have not been updated to Vercel.
4. Marketplace checkout, settlement, refunds and delivery are not enabled. The public B2B page says so explicitly. This MVP must not be advertised as a completed escrow/payment marketplace.
5. The multi-tenant seller/organization/proposal endpoints in `workers/marketplace/src/index.js` require a separately deployed/configured worker and Cloudflare Access settings; they are source-ready, not production-ready.

## Required release configuration

Set these as **server-side sensitive environment variables** on the existing Vercel `dreamledger` project:

- `NEON_DATABASE_URL`: privileged connection string for the isolated Neon marketplace database only.
- `B2B_ADMIN_TOKEN`: random high-entropy token for the private RFQ inbox.
- `RATE_LIMIT_SALT`: random high-entropy salt for hashed-IP rate limiting.

Then redeploy the branch/commit, verify `/api/marketplace/listings`, `/api/marketplace/rfqs`, `/api/marketplace/intake`, and `/api/marketplace/admin` against the deployment URL, and only then promote the release. Do not place any of these secrets in public HTML, Git, or client-side JavaScript.

## Product boundary

This is a practical first-stage alternative: free buyer demand intake, public verified supply, a private lead inbox and local quote comparison. It is not yet a full replacement for Trade Me's accounts, moderation, search, seller inventory, messaging, payments, disputes, shipping and consumer protections. Those features should be released only after authentication, data isolation, abuse controls and end-to-end transaction tests pass.


## Seller-side closure (2026-10-26, latest)
- Replaced the previous `sell.html` behavior that could fall back to browser `localStorage` and still display a success-like message.
- Seller submissions now POST to `/api/marketplace/seller-intake`, require explicit contact consent, use an idempotency key, validate price/quantity/email/kind, apply the shared five-per-hour IP-hash rate limit, and persist only to private `marketplace.public_seller_intake`.
- Seller submissions remain private applications in `received` status. They do not create public listings and do not enable checkout.
- The private operator inbox API and page now include seller applications alongside buyer RFQs, with export covering both queues.
- The additive migration was tested on a temporary Neon branch, then applied to the isolated `dreamledger-migration-staging` project's main branch. A fresh query confirmed 12/12 marketplace tables have RLS enabled and `public_seller_intake` exists.
- The B2B validation, public surface guard, e-commerce smoke, and full build workflows passed for commit `efce37f7de339f3bec6cec98b70e41db084ecb8e`.

## Current hard blocker
The Vercel integration returns 403 for reading the deployment and 404 for the previously recorded project ID under the currently connected team. Its response explicitly says the deployment's project/team must be authorized in the Vercel connection. Project listing for that team returns zero projects. I cannot safely set server-side environment variables, verify the deployed API, assign the domain, or promote a production deployment until the correct Vercel project/team is authorized. No public listing, buyer request, or seller application has been fabricated to simulate a live marketplace.
