# Gauntlet ↔ Elohim scorecard loop — 2026-10-16

## What is being done now
1. **Economic validation** — live `/buy/*` Stripe paths; HTML hubs on main; deploy still gates full site refresh.
2. **Elohim schema gate** — `validateElohimProduct.js` on create + ProductCompiler quarantine.
3. **Scorecard reinforcement** — `emitGauntletScorecard.js` so Elohim emits per-surface scorecards from sentinel/trend signals; gauntlet has checks to judge.
4. **Surface coverage registry** — storefront, mtg, avatar, digital_products, crypto, media_music, phinhaven, figure_eight.

## Figure-eight
Reuse existing trip contract: usable artifact + compounding component + hashed receipt. Scorecard surface `figure_eight` encodes those requires.

## Not done
- Automated Sentinel → scorecard cron (module is callable; wire to jobs when ready)
- Live site HTML = main (Render)
- First settled-payment fossil → VERIFIED economic claim
