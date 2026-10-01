# Toll Road Traversal Proof - 2026-10-02

Objective:
Traverse existing DreamLedger substrate with a commercialization lens, prioritizing services that can run with zero owner minutes after payment.

Existing sellable substrate observed:
1. Supplier Quote Comparison: NZ$49 one-time, public checkout, digital fulfilment path.
2. Document Extraction: NZ$5 toll booth, existing Stripe price metadata DOC-EXTRACT-50.
3. Supplier Verification: NZ$5 toll booth, existing Stripe price metadata SUPPLIER-CHECK-50.
4. Evidence Packet: NZ$10 toll booth, existing Stripe price metadata EVIDENCE-PACKET-10.
5. Seller Profit Audit: NZ$29 existing Stripe price, currently marked manual_pdf and therefore not zero-touch.
6. C2 Decision Analysis: NZ$5 hosted/deterministic digital result path with canonical settlement checks.
7. Agent Bridge: existing authenticated rail with signed leases and independent verifier, but its current toll catalog uses an adjacent purchase rather than a dedicated bridge SKU.
8. Truth Oracle: existing paid entitlement/subscription commerce route, but its customer access model is account/session based rather than a machine key wall.
9. Candidate Gauntlet: existing deterministic candidate validation engine. It is safe to expose as a paid, no-external-action service because it filters and produces proof without publishing or transacting.

Commercial design selected:
- Discovery remains public.
- Payment remains Stripe.
- Settlement remains the economic boundary.
- A customer entitlement produces a signed, scoped toll key.
- The key opens only the purchased service wall.
- Customer keys never grant internal AgentBridge worker authority.
- Automated audits/validation are zero-human fulfilment.
- No public action, payment claim, buyer claim, settlement claim, or verified economic outcome is created by a Gauntlet/Truth request.
- Internal Truth Oracle remains the evidence boundary.

Implemented substrate:
- BEC-PRIME/runtime/TollRoad.js
- BEC-PRIME/routes/tollRoad.js
- public/toll-road.json
- public server route: /api/toll/v1/*
- Toll wall is fail-closed when DREAMLEDGER_TOLL_KEY_SECRET is absent.
- Dedicated Stripe product/price IDs are configuration inputs, not created automatically.
- No Stripe mutation was performed.
- No payment was created.
- No customer key was fabricated.
- No internal bridge authority was delegated.

Current blocker:
DEDICATED_STRIPE_ENTITLEMENT
A dedicated live Stripe price for GAUNTLET-RUN and TRUTH-ORACLE-ACCESS must exist before autonomous customer key issuance can become commercially live. Existing Stripe prices were found for adjacent toll services, but none were identified as a dedicated Gauntlet/Truth toll key product.

Required next move:
Configure dedicated Stripe prices and wire settled webhook events to TollRoad.issueKey. This is the only remaining commercial ignition step for the key wall.

Economic truth remains unchanged:
VERIFIED_EXTERNAL_REVENUE = NZ$0.00
SETTLED_EXTERNAL_PAYMENTS = 0
INDEPENDENT_EXTERNAL_BUYERS = 0
VERIFIED_ECONOMIC_OUTCOMES = 0
