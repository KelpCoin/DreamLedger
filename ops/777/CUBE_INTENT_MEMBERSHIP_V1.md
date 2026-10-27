# 777 CUBE intent-matching and membership scaffold

Status: PRIVATE REVIEW, not production. MTG/HappyHomarid is the master test fixture only. Cross-silo examples cover B2B, digital goods and memberships. This is not a new ledger, storefront or payment processor.

## Reuse map
- `BEC-PRIME/sentinels/schema/intent-note.json`: intent observation is never settlement.
- `runtime/cube/manifests/buyer_requirement_matching_29.json`: existing buyer brief plus catalogue template.
- `BEC-PRIME/catalog/transparency/patreon-role-policy.json`: progressive disclosure policy. Configure actual Patreon tier and Discord role identifiers per silo, never infer from named prices.
- `BEC-PRIME/data/creator/word-bank.json` and `stencils.json`: per-silo copy and stencils; generated copy does not prove demand.
- Existing CUBE / Elohim / Gauntlet / Truth Oracle / Agent Bridge / Stripe and fulfillment retain their existing source-of-truth boundaries.

## Code introduced
- `BEC-PRIME/sentinels/cube_intent_match.mjs`: private, deterministic, fail-closed option matcher for consented buyer requests and seller-confirmed supply and capacity. Does not message buyers, charge, publish or record economic success.
- `BEC-PRIME/sentinels/cube_membership_access.mjs`: private, silo-scoped Patreon membership assertion evaluator mapping verified provider tier to a configured Discord role and progressive disclosure class. An *upstream* trusted provider connector must actually verify membership, signature/identity and current entitlement. This module does not grant roles or collect payment.
- Tests: `node --test tests/cube-intent-match.test.mjs tests/cube-membership-access.test.mjs`.

## Cross-portfolio product architecture
DreamLedger is intended to combine personal identity spaces, friend communities, professional reputation, storefronts, marketplace/auctions, avatar/game items, creator memberships and programmatic billboard/DOOH surfaces. The hypothesis is that voluntary customization, personal reputation, user-owned content, community experiences and creator identity produce repeat participation and measurable organic growth. Do not equate feature design with actual retention, revenue, or network effects.

Each silo supplies a scoped `silo_id`, branding, owner, catalog/capability IDs, seller-feasibility rules, content and privacy policy, tier mapping, member access rules, word bank and stencil references. Shared modules provide consented request matching, authorization, evidence and fulfillment handoff. Strict boundaries prevent data/branding leakage between MTG/HappyHomarid and sensitive unrelated silos.

## Exact economic boundary
Observed interest -> explicitly accepted scoped terms -> authenticated paid external checkout -> successful PaymentIntent and non-refunded Charge -> independent buyer and settlement proof -> completed fulfillment + buyer-retrievable delivery -> measured net contribution -> existing independent Truth Oracle reconciliation. A private match never increments verified revenue. Never claim 419 sessions represent unique buyers or a 10x improvement. A Discord webhook is not an authenticated Patreon entitlement connector and cannot securely manage guild roles by itself.

## Staged acceptance, not automatic rollout
1. Read exact existing relevant provider schemas and identity/consent boundaries; do not invent Stripe price/link, Redis, database table, n8n or extra hosted service.
2. Execute offline tests. Include mismatched silo, revoked member, unknown tier, missing opt-in, checkout-open, uncounted physical stock, unconfirmed delivery capacity.
3. Only if those pass, integrate as read-only PRIVATE queue recommendations into existing 777 SENTINEL-001 and DEMAND-003. Reconcile deterministic source IDs and dedupe. Owner approval before any outward message, membership grant, public release or financial action.
4. Prove an independent paid-and-delivered order through the existing shared commercial primitives before scaling automation. Monetization and Figure Eight cloud/local independence are parallel objectives; don't make all sovereignty work wait for a first sale.
