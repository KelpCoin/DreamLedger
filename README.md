# DreamLedger

DreamLedger is an independent commerce and digital-world verification surface.

The public product is intentionally small: structured offers, focused checkout surfaces, canonical item identity, and evidence-gated economic claims.

## Public principles

- Evidence before claims.
- A checkout surface is not proof of payment.
- A test fixture is never treated as real economic evidence.
- Canonical items are defined once and may be presented by multiple compatible experiences.
- Avatar and game surfaces reference the same canonical item identity rather than creating duplicate item records.
- Private implementation details, credentials, customer data, internal controls, and unpublished operational material are not part of the public product surface.

## Commercial control plane

- Public commerce surface: https://dreamledger.org
- Brand / holding surface: https://amplissa.com
- Canonical repository: https://github.com/KelpCoin/DreamLedger
- Current MTG NZ$29 checkout: https://buy.stripe.com/00w7sLaXP01n96nbN2dwc2l
- Permanent QR policy: `IP/QR/QR-DESTINATION.txt`
- Markets: `MARKETS/MARKET-MATRIX.md`
- Social distribution: `SOCIAL/SOCIAL-VIRALITY-PLAYBOOK.md`
- IP custody: `IP/MASTER-IP-MAP.md` and `IP/PUBLIC-IP-MANIFEST.md`
- Execution architecture: `CONTROL-PLANE/COMMERCIAL-INTEGRATION.md`

The live Stripe account currently exposes an active, one-time NZD 29 Commander Deck Diagnostic Payment Link. The line item is `Commander Deck Diagnostic`, quantity 1, amount NZD 29.00. External settlement evidence is still required before revenue is claimed.

## Execution spine

`Signal -> qualification -> approved response -> offer -> checkout -> external payment evidence -> verified revenue -> fulfilment -> learning -> winner candidate`

MTG is the first controlled commercial laboratory. The $29 Commander Deck Diagnostic is the first armed offer.

Social publication, irreversible production changes, and other public commercial actions remain approval-gated. Automation cannot manufacture revenue, customers, traffic, testimonials, publication, or payment evidence.

## Live settlement spine

`Stripe live Checkout Session -> GitHub Actions -> Airtable Economic Events -> proof artifact`

The workflow is `.github/workflows/commerce-settlement-sync.yml` and the implementation is `ops/commerce/reconcile-stripe-airtable.mjs`.

The workflow accepts only a completed, paid NZ$29 NZD Checkout Session associated with the configured live Stripe Payment Link. It is idempotent on the Checkout Session ID and writes verified economic events to Airtable only after external Stripe evidence exists.

## Kelplantis v6

A hardened playable 100-floor slice is included at `BEC-PRIME/kelplantis/kelplantis-v6.html`. It uses one coordinate system, versioned local saves, deterministic floor generation, explicit boss state, bounded movement, pointer controls for mobile, keyboard controls for desktop, and a DreamMeez identity stub.

## 60-second verification

From `BEC-PRIME`:

`npm ci`

`npm run compile`

For settlement verification, manually run the GitHub Actions workflow `Commerce Settlement Sync` and inspect the uploaded `commerce-settlement-proof-{run_id}` artifact.

Expected pre-sale state is `verified_revenue_nzd: 0`. After a real live NZ$29 payment through the configured Commander Deck Diagnostic Payment Link, the artifact must contain a newly recognized `STRIPE-CHECKOUT-cs_...` event and `verified_revenue_nzd: 29`.

## Revenue truth

Current verified revenue remains NZ$0 until a real external payment is independently evidenced. CI, CD, QR generation, IP registration, market research, Gauntlet passes, and social-content generation do not alter that number.
