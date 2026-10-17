# Ten-silo candidate portfolio

This directory contains the existing MTG Commander diagnostic definition plus nine additional candidate definitions. The candidate prices and buyers are hypotheses, not validated demand or forecasts.

## What this change does

- Defines each proposed offer using the existing `dreamledger/cube-swarm-silo-definition/v1` shape.
- Records a draft-only catalogue contract, proposed library/route/Supabase function paths, source-backed acceptance criteria, and settlement/fulfillment proof requirements.
- Adds bounded internal candidate-build task contracts with hashes and explicit gates.
- Keeps all proposed checkout URLs empty, checkout disabled, cards hidden, and provisioning set to dry-run only.
- Keeps `public/catalog.json` unchanged, avoids deployment, and leaves verified revenue at NZ$0.

## Important runtime limitation

The current North Star controller still runs the hard-coded `MTG-CMD-DIAG-29-READ-ONLY-AUDIT` priority task. These new task contracts are not consumed by its selector yet. Adding definitions alone does not make the swarm build their libraries/routes/functions. A separate, reviewed selector/worker implementation is required before automatic task cycling can be claimed.

## Release gates

1. Fix and verify the existing shared Stripe Gate 1 configuration using the authorized secret path.
2. Complete one independent live settlement, attribution, report fulfillment, and delivery proof for the existing NZ$29 diagnostic.
3. Wire task selection to these contracts and have generated implementation plans include hashed source evidence.
4. Build and test each candidate internally; never expose candidate entries as purchasable by default.
5. Deploy only after separate approval and only after each offer independently passes its SKU, price, checkout, settlement, fulfillment, and delivery tests.

The NZ$3,000,000 goal is a gross-revenue objective before refunds, fees, tax, and costs. The arithmetic scenarios in the portfolio are unit counts, not a forecast, buyer-demand signal, or profit estimate.
