# Permanent Render exit: container runtime

## Decision

Move the existing Node.js 24 application to a Docker-based Fly Machine, with the storefront as the only public listener and the engine bound to loopback in the same machine. Keep the existing Supabase database and Stripe configuration unchanged during the host move. Cloudflare DNS/CDN can remain the edge layer, but it is not part of the first cutover.

This is the runtime-compatible option. The current application is not a static website: public/server.js and BEC-PRIME/start.js use Node HTTP APIs, route modules, preloads, filesystem-backed records and Stripe webhook logic. The Cloudflare Pages preview currently blocks dynamic commerce and webhook routes. Porting all of those behaviors to Workers would be a separate code and persistence migration.

## What this package does

- Builds with Node 24 and runs the repository's canonical BEC-PRIME build.
- Starts the engine at 127.0.0.1:3000, waits for engine health, then starts the public storefront on port 8080.
- Exposes only port 8080 through the Fly service configuration.
- Supervises both Node processes. If either exits, the container exits instead of leaving a misleading green storefront.
- Places the engine's configured ledger, proof, QR, jobs and Dreamiez data directories on the mounted /var/data volume. It also seeds and links BEC-PRIME/data without overwriting files already on the volume.
- Does not deploy automatically, create a Fly account or resource, change DNS, modify Stripe, migrate Supabase or disable Render.

## Build check

Run these commands from the repository root:

    sh -n ops/migration/render-exit/start.sh
    node --test ops/migration/render-exit/contract.test.mjs
    docker build --file Dockerfile.render-exit --build-arg GIT_COMMIT=local-check --tag dreamledger-render-exit:local .

GitHub Actions runs the same secretless container build for relevant pull requests. A successful image build is necessary but is not production acceptance.

## Owner setup required for a preview

Fly requires an account and a payment method for an organization, and running Machines, provisioned volumes and network egress are billable. No Fly account or resource is created by this repository branch.

1. Review the plan and monthly cost in the Fly dashboard before creating anything.
2. Choose a unique Fly app name, edit fly.render-exit.toml and create the app.
3. Create the dreamledger_data volume in region syd, initially 1 GB to match the current Render disk size. Do not assume this is enough until the current volume usage has been measured.
4. Set the listed secret values using the provider's secret store. Never commit credentials or paste them into GitHub files.
5. Deploy to the Fly-provided hostname only. Do not attach dreamledger.org and do not change Cloudflare DNS yet.
6. Export the current Render /var/data volume to an encrypted archive, generate a SHA-256 manifest, import it to the preview volume, and verify file counts and hashes before any production test that depends on existing state. Keep the source archive out of Git.
7. Run route parity for /, /healthz, /version, /billboard, /mtg, /api/products, /api/offers, the engine proxy, and the existing Stripe webhook route. Confirm /version reports the release SHA.
8. Use test-mode Stripe events to verify signature validation and duplicate-event idempotency. Do not alter the production webhook URL during preview tests.
9. Validate the existing silo and commercial-truth tests. Checkout HTTP success is not revenue evidence.
10. Confirm that a rollback to Render remains possible from the retained old service and data. Only after all evidence passes should the owner explicitly authorize domain cutover.

## Secret names

Configure the existing values in the Fly secret store: ENGINE_INTERNAL_API_KEY, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, DREAMLEDGER_TOLL_KEY_SECRET, DREAMLEDGER_AGENT_BRIDGE_TOKEN, DIGITAL_PROXY_APPROVAL_TOKEN, MARKETPLACE_ADMIN_TOKEN, M2M_API_KEY, QR_API_KEY, QR_IP_SALT, and RESEND_API_KEY. Set RESEND_FROM_EMAIL if email delivery currently depends on it.

The Supabase URL remains the existing project URL in non-secret configuration. Do not rotate keys or migrate the database as part of this host move.

## Cost and budget

This option is not a zero-cost always-on server. Fly bills a running Machine, provisioned volume capacity and outbound traffic; its current pricing requires a card on file for standard organizations. Check the provider's live estimate before provisioning. If the account must remain at NZ$0 spend until a verified sale, do not create Fly resources yet. The alternative is a broader Cloudflare Workers plus durable-storage port, not deploying the existing static preview and claiming migration success.

## Evidence boundary

Contract and Docker build tests only establish that the proposed image builds. The migration remains blocked until real preview hosting, state import/read-back, route parity, test-mode webhook idempotency and rollback evidence pass. The production domain, payment configuration, database and Render services must remain unchanged until explicit approval.
