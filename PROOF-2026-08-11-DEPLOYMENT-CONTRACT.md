# DreamLedger Deployment Contract Proof

Date: 2026-08-11

## Repository facts

- Repository: KelpCoin/DreamLedger
- Production server: BEC-PRIME/server.js
- Production package: BEC-PRIME/package.json
- Render Blueprints: render.yaml and BEC-PRIME/render.yaml
- Render rootDir: BEC-PRIME
- Render buildCommand: npm install && npm run compile:offers && npm run compile:surface && node --check server.js
- Render startCommand: npm start
- Render healthCheckPath: /healthz
- Public base URL: https://dreamledger.org

## Deployment change

The Render autoDeployTrigger was changed from checksPass to commit in both Blueprints. The repository had no reported GitHub status checks or workflow runs for the latest commits, while the deployment workflow also probed the already-deployed public service. Using checksPass therefore created a deployment dependency on external production state. commit makes the repository push the deterministic deployment contract directly to Render's configured main branch.

## Runtime facts

- GET /healthz is implemented by BEC-PRIME/server.js.
- GET /api/products is implemented.
- GET /api/offers is implemented.
- GET /api/control/health is implemented.
- Stripe checkout remains approval-gated by the compiled offer catalog.
- No real payment was initiated by this change.

## Live proof status

As of this proof commit, live endpoint verification could not be established from the available connected environment. Web retrieval returned the older cached Dream Ledger Deck for the root URL and could not fetch the API routes. Therefore this artifact deliberately records DEPLOYMENT_TRIGGERED_NOT_YET_LIVE rather than claiming production health.

Required live checks after Render finishes the deploy:

- GET https://dreamledger.org/healthz -> HTTP 200
- GET https://dreamledger.org/api/offers -> HTTP 200 with public offer records and no capability_id fields
- GET https://dreamledger.org/api/products -> HTTP 200
- GET https://dreamledger.org/api/control/health -> HTTP 200

## Local verifier

cd BEC-PRIME
npm run smoke:revenue-ledger
npm run gauntlet
powershell -ExecutionPolicy Bypass -File ..\scripts\Verify-Registry.ps1

## Live verifier

curl.exe -i https://dreamledger.org/healthz
curl.exe -i https://dreamledger.org/api/offers
curl.exe -i https://dreamledger.org/api/products
curl.exe -i https://dreamledger.org/api/control/health
