# DreamLedger Deployment Contract Proof

Date: 2026-08-11

## Verified repository facts

- Repository: KelpCoin/DreamLedger
- Production server: BEC-PRIME/server.js
- Production package: BEC-PRIME/package.json
- Render Blueprint: BEC-PRIME/render.yaml
- Root Render Blueprint: render.yaml
- Render rootDir: BEC-PRIME
- Render startCommand: node server.js
- Render healthCheckPath: /healthz
- Public base URL: https://dreamledger.org
- Commander product required by build verification: catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json

## Important boundary

This artifact proves the repository contains an explicit Render deployment contract. It does NOT prove that the Render service has applied that contract or that the public service is healthy.

## Required live proof

GET https://dreamledger.org/healthz must return HTTP 200.
GET https://dreamledger.org/api/products must return HTTP 200.
GET https://dreamledger.org/api/products/COMMANDER-DECK-DIAGNOSTIC-001 must return HTTP 200.

## Verification command

curl.exe -i https://dreamledger.org/healthz
curl.exe -i https://dreamledger.org/api/products
curl.exe -i https://dreamledger.org/api/products/COMMANDER-DECK-DIAGNOSTIC-001
