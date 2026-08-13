# Render Gate 2

Deployment contract for DreamLedger.

Required Render service settings:

- Root directory: BEC-PRIME
- Runtime: Node
- Build command: npm install && npm run compile
- Start command: npm start
- Health check: /healthz
- Branch: main
- Domain: dreamledger.org

The application must bind to the PORT supplied by Render. Do not hardcode PORT=10000.

Verification:

    Invoke-RestMethod -Uri https://dreamledger.org/healthz -TimeoutSec 90
    Invoke-RestMethod -Uri https://dreamledger.org/api/offers -TimeoutSec 90 | ConvertTo-Json -Depth 10

This file is operational documentation only. It does not claim that the live Render service is healthy.
