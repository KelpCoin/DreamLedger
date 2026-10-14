# Canonical QR distribution

## One canonical buyer/referral doorway

Canonical QR destination:

`https://dreamledger.org/go?src=qr-canonical`

The QR redirects through DreamLedger's first-party `/go` attribution doorway and lands on the general DreamLedger home page. It does not force every buyer into the billboard offer. Scan/click telemetry is an acquisition signal only, never revenue.

## Canonical asset

- Web and artifact asset: `public/assets/qr-canonical.svg`
- Routed alias: `public/qr/canonical.svg`
- Printable insert: `public/qr/fulfillment-insert.html`
- Runtime metadata helper: `BEC-PRIME/lib/canonicalQrFulfillment.js`
- Generator: `BEC-PRIME/distribution/QRAssetCompiler.js`
- Campaign-specific tracked QR variants: `BEC-PRIME/distribution/QR-CampaignPlanner.js`

Do not replace the canonical customer insert with a third-party destination. Per-placement campaign QRs are separately generated from the distribution matrix so each allowed placement has its own tracked URL.

## Automatically attach it to purchases

Every customer-facing digital fulfillment should carry the QR image and canonical URL alongside its deliverable. Every physical order's generated packlist should include the printable insert. A generated insert is not proof that it was physically packed or delivered; fulfillment evidence still needs to record the actual delivery step.

Current wired examples on the master branch candidate:
- Commander diagnostic report metadata and delivery page.
- Billboard auto-fulfillment record.
- Reusable printable insert for physical goods.
- Reusable fulfillment metadata helper for future product-specific outputs.

Coverage is partial until each product-specific fulfillment path and the live deployed site are tested.

## Legal distribution policy

The planner can autonomously generate QR variants, landing URLs, and campaign packets. It may publish only to first-party surfaces where DreamLedger controls the placement and the relevant action is already authorized by the site's release policy.

For third-party clubs, game stores, events, creators, forums, Discord communities, newsletters, and social feeds, the planner prepares copy and artwork only until explicit permission and channel rules are recorded. It must not mass-DM, scrape email addresses, inject into unrelated communities, bypass moderation, or spend on ads without explicit budget approval. Respect opt-outs, platform rules, privacy, intellectual property, and local marketing law.

Owned channels and permitted third-party placements have separate campaign IDs and measured destinations. Campaign success must be measured by qualified actions, accepted offers, settled payments, fulfillment and delivery evidence, not QR scan count alone.

## Operating modes

- **Generation:** automatic and testable in CI.
- **Owned web surfaces and fulfillment artifacts:** can be integrated into first-party releases and customer deliveries.
- **External distribution:** prepare-only until the channel/venue owner and policy requirements are satisfied.
- **Paid placement:** disabled unless explicitly budget-authorized.
- **Revenue claims:** require independent external settlement, correct attribution, fulfillment and retrievable delivery evidence.

See `BEC-PRIME/distribution/QR-DISTRIBUTION-MATRIX.json` and `BEC-PRIME/distribution/generated/QR-CAMPAIGN-PLAN.json` for the machine-readable plan.
