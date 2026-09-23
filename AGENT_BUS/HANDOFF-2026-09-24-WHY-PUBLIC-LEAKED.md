# Why internal language still reached the public (and what was fixed)

## Honest answer

1. **Homepage (`marketplace-v21`)** was already cleaned of meter/spine/fossil chrome. If it “still looked like trash,” residual causes were other routes + design taste + deploy lag history — not Elohim on the home nav after v21.

2. **Real remaining leaks (verified 2026-09-24):**
   - `/agent-commerce.json` — still published ops fields: `settlement_spine`, `evidence_fossil`, `cs_`, `verified_external_revenue_nzd`, `fail_closed`, protocol alphabet soup.
   - `/b2b` — still the old **CUBE Marketplace** page (“source-silo rules”, internal silo grid). Served from `compiled/website/marketplace.html` via route alias, **not** from `public/index.html`.

3. **Why the gauntlet / public-surface script did not stop it**
   - `verify-public-surface.js` mainly blocked **secrets** and a few adult/private tokens.
   - It did **not** treat `fossil`, `cs_`, `settlement_spine`, `Elohim`, `gauntlet`, `AGENT_BUS`, etc. as PUBLIC_LEAK.
   - Cloud multi-LLM refinement cannot catch what the gate does not forbid.
   - PC off is irrelevant for this class of failure: the bad strings were **already in the deployed git artifacts**.

4. **Dual surface problem**
   - Human home: often `public/index.html`
   - `/b2b` static alias: `BEC-PRIME/compiled/website/marketplace.html`
   - Cleaning only `public/index.html` never fixed `/b2b` or agent-commerce ops JSON.

## Fixed on this pass

- Rewrote `public/agent-commerce.json` → customer/partner-safe v2 (no fossil/cs_/spine)
- Replaced `compiled/website/marketplace.html` with plain **Business** page
- Expanded `verify-public-surface.js` forbidden list to ops vocabulary + scans `public/` contracts

## Rule for every LLM

Public HTML and public JSON = **buyer English**. Ops truth stays in `AGENT_BUS/` and private proofs — never in storefront contracts.
