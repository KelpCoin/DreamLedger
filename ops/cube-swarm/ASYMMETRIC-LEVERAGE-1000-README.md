# Asymmetric Leverage 1,000-Candidate Bank

This normalized seed bank contains 1,000 unique candidate silo specifications: 40 business/domain families multiplied by 25 reusable productized mechanisms. The domains and mechanisms are drawn from the existing BrownEye/DreamLedger factory, evidence, source-audit, catalogue, data-normalization, pricing, fulfilment, and proof substrate, combined with preserved conversation-library ideas (BrownEye Tri-Fecta, BrownEye Exit Bible, earlier SKU factories, OCR-to-action, BoringMoney, VentureTrioForge, creator/media, marketplace, price comparison, NZ business-data, and governed automation).

## Existing Cube Swarm intake

`BEC-PRIME/compiler/FactoryFactoryCompiler.js` already scans JSON lane manifests from `runtime/cube/manifests`. The generator expands the compact bank into 1,000 individual silo definitions, 1,000 task contracts, and 1,000 lane manifests. The existing FactoryFactoryCompiler, Factory-Factory, and Universal Factory stages consume the lane manifests and produce queue/cell artifacts.

## Compile

```bash
node ops/cube-swarm/compile-asymmetric-leverage-bank.mjs
npm run compile:opportunities
npm run compile:factory-factory
FACTORY_FACTORY_BATCH=2000 node BEC-PRIME/factory/FactoryFactory.js
UNIVERSAL_FACTORY_BATCH=2000 npm run factory:universal
```

The CI workflow runs these as internal compilation and uploads candidate definitions/tasks/manifests plus the proof index. Candidate tasks are not yet connected to the hard-coded North Star selector; this does not imply 1,000 implementations, pages, routes, or deployed functions exist.

## Guardrails

All candidate offers are hidden, draft-only, and have no Stripe IDs or checkout URLs. The generator does not mutate `public/catalog.json`, use secrets, write to a production database, make payments, contact buyers, or deploy functions. Each candidate includes real SHA-256 hashes of the declared repository sources. Those hashes establish the reused implementation substrate, not external demand.

Scores prioritize domain/mechanism fit and infrastructure reuse only; they are not revenue forecasts. Gate 1 and the first independent payment-to-delivery proof remain separate blockers. Revenue remains NZ$0 until settlement, attribution, fulfillment, delivery and independent evidence are verified.
