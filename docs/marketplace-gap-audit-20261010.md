# Marketplace gap audit and reuse decisions (2026-10-10)

## Objective

Build one trustworthy commercial loop before expanding surface area:

**buyer intent → discoverable offer → server-priced checkout → verified settlement → durable order → fulfilled delivery → attributable evidence.**

Millions per month is an ambition, not a forecast. No code or CI run establishes demand, conversion, or profit. The first measurable target is one independent buyer completing this loop, then repeatability and unit economics.

## Confirmed release blockers in the current repository

1. **Supabase is unavailable at the data plane.** B2B routes now fail closed when the canonical database/auth service is unavailable. The migration has not been applied and cannot be safely applied until the provider restores PostgreSQL and the existing migration history/schema/RLS are inspected.
2. **Migration version collisions exist.** The two newest migration files originally shared the version `20261010120000`; the webhook migration has been renamed to `20261010120100`. The wider repository also contains historical duplicate numeric migration prefixes (including several date-only prefixes). The new CI preflight deliberately reports these instead of silently declaring migrations safe. Do not mass-rename historical migrations without comparing the live `supabase_migrations.schema_migrations` history after recovery.
3. **The settlement code and migration are not production proof.** A source-level contract is not a successful webhook run. Verify atomic event claiming, stale-claim recovery, order uniqueness by Checkout Session ID, entitlement/fulfillment uniqueness, refund/dispute handling, and retry behavior in a disposable test-mode path before enabling real checkout.
4. **A2A checkout remains disabled.** HMAC quote signing is not order persistence or settlement. The current endpoint must stay fail-closed until a durable order can be created before checkout and the payment-to-delivery chain is tested.
5. **Production configuration and deployment remain separate gates.** `M2M_QUOTE_SIGNING_SECRET`, Supabase Auth config, deployed Edge Function version, webhook endpoint enablement, and storefront routing must be verified in the target environment. This PR does not claim to configure them.

## Open-source patterns worth reusing, not wholesale replacing the stack

- [SuperRedHat/webhook-idempotency-demo](https://github.com/SuperRedHat/webhook-idempotency-demo): durable inbox → transactional outbox → idempotent worker, plus crash/replay tests. Adapt the invariant and test strategy to Postgres; do not adopt its SQLite/FastAPI implementation as a second DreamLedger ledger.
- [Skeeb32/gather](https://github.com/Skeeb32/gather): useful patterns for row-locked inventory, atomic order fulfillment, Stripe Connect transfers, RLS isolation, retryable delivery, and concurrency tests. Its ticketing domain is not a drop-in marketplace backend.
- [spree/storefront](https://github.com/spree/storefront): MIT-licensed Next.js storefront with B2B/wholesale and multi-region UX. It is a possible future storefront reference, not a reason to replace the existing DreamLedger surfaces before the first sale.
- [TahirPK007/ecommerce-store](https://github.com/TahirPK007/ecommerce-store): a smaller Supabase + Stripe checkout example. Treat it as a learning reference only; its demo checkout and success-page confirmation are not sufficient evidence for DreamLedger's financial invariants.

## Revenue focus and anti-trap rules

- Keep the supplier quote comparison worksheet free as currently decided. Do not reactivate retired NZ$49 quote-comparison links.
- Do not build another payment rail or marketplace subsystem while the existing Stripe → order → fulfillment path is unproven.
- Do not count traffic, checkout creation, test events, AI scores, migrations, PRs, or internal ledger rows as revenue.
- After recovery: inspect first, preflight second, migrate third, deploy one controlled function, execute a labelled test-mode payment, verify order/entitlement/fulfillment exactly once, and only then authorize a live commercial transaction.
- Until that loop passes, acquisition and demand experiments should use existing public surfaces and must not involve unapproved personal outreach or paid spend.
