# HANDOFF — B2B APIs, orchestration, surface v21

## OBSERVED

Live dreamledger.org still served **pre-v20** ops HTML (Meter NZ$0, settlement spine, fossil). Git had v20; Render lag.

## CHANGED

- `public/index.html` → **marketplace-v21** (production buyer UI, no ops chrome)  
- `public/b2b/catalog.openapi.json`  
- `docs/b2b/MARKETPLACE-API-APPLIED.md`  
- `docs/agents/ORCHESTRATION-APPLIED.md`  
- Deploy trigger file  

## PERSISTED

GitHub main (this commit).

## VERIFIED

Live site content before this push still old (UNVERIFIED after deploy).

## UNVERIFIED

Render has picked up v21; any sale.

## BLOCKED

Deploy pipeline delay; external buyer.

## NEXT

Operator: force Render redeploy if v21 not live in 10m. Hard refresh. Then post tile link.
