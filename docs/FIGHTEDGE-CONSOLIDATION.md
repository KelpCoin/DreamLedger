# FightEdge consolidation contract

## Decision

FightEdge is a DreamLedger service wall, not an independent production platform. The canonical public route is:

- `https://dreamledger.org/fightedge/`
- Actual served file: `fightedge/index.html` at the repository root, because the connected production Render service `dreamledger-org` reports `publishPath: .`
- Mirrored source file: `public/fightedge/index.html`; CI requires these files to remain identical
- Intended blueprint service: `dreamledger-storefront` in `render.yaml` declares `rootDir: public`, but this is not the service configuration currently returned by Render

No FightEdge-specific Render service, ledger, payment rail, queue, Supabase project, or truth engine should be created.

## Compatibility

The existing DreamLedger storefront server serves `/fightedge` and `/fightedge/` directly from `fightedge/index.html` through its public route map. It does not proxy requests to another Render service. The Next.js project under `sports/fightedge/web` is retained as a compatibility surface during retirement. Its middleware permanently redirects Render-hosted `*.onrender.com` requests to the first-party DreamLedger route, preserving query strings and mapping legacy deep links to the closest first-party section. Legacy static aliases also route to `/fightedge/`.

The connected Render MCP currently exposes inventory, deployments, logs and environment-variable operations, but no safe suspend/delete operation. Therefore the old Render resources remain infrastructure cleanup debt; they are not the canonical public route. Do not claim they were suspended or deleted until Render confirms that state.

## Shared platform contracts

- Discovery and navigation use DreamLedger's existing public service catalogue.
- Evidence quality uses the existing Truth Oracle and Gauntlet conventions.
- Common event and service identity belongs to the existing CUBE/manifest contract.
- Any future offer must use the existing canonical offer → checkout → settlement → entitlement → fulfillment → evidence chain.
- No automated wagering. No fabricated odds, sources, buyers, revenue, outcomes or performance.
- Supabase remains the intended durable shared truth layer; Notion/Airtable are mirrors, not substitutes. Database writes are not claimed while the production Postgres endpoint is unavailable.

## Promotion gates

1. CI verifies that the canonical route is first-party and the Render manifest has no standalone FightEdge service.
2. Merge triggers the existing DreamLedger Render deployment.
3. Verify `/fightedge/`, both legacy aliases, and old/new FightEdge Render host redirects over HTTP.
4. Retire the two old Render resources only after route verification and a supported Render control operation.
5. Keep economic status at zero until independent settlement, fulfillment and delivery evidence are joined.

## Current observed state

- `fightedge-web-live`: last observed deployment live, but it is no longer intended to be the canonical public surface.
- `fightedge-web`: repeated build failures on `npm ci`; its logs showed 502/503 responses.
- `dreamledger-storefront`: existing DreamLedger static custom-domain service and canonical host.
- Verified revenue from this consolidation: none claimed.
