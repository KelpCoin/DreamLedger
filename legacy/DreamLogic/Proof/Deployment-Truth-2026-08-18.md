# DreamLedger Deployment Truth

Date: 2026-08-18

## Source

Repository: KelpCoin/DreamLogic
Branch: main
Latest source commit after this proof was created: see GitHub main branch.

## Changes executed

- Added scripts/compiler.js as the BrownEye Cortex release orchestrator.
- Changed npm build to execute the compiler.
- Compiler produces the isolated DreamLedger static artifact in dist-pages/.
- Compiler produces the DreamLedger Node release artifact in dist-release/dreamledger/.
- Amplissa is explicitly SOURCE_REQUIRED and is refused by the compiler unless a separate source root is supplied.
- GitHub Pages workflow now builds the compiler artifact instead of publishing raw docs/ directly.
- Added MTG progressive transparency tier contract.
- Added public DreamLedger transparency surface.
- Added the transparency link to the DreamLedger MTG storefront.

## Truth states

SOURCE: PASS, repository writes are visible in Git history.
BUILD: PENDING RUNTIME VERIFICATION, GitHub Actions must execute the new compiler.
DEPLOYMENT: PENDING RUNTIME VERIFICATION, Pages deployment must complete.
LIVE: PENDING HTTP VERIFICATION, dreamledger.org must return the new surface.
AUTH: NOT CLAIMED, static Pages cannot provide the existing Node login runtime.
PAYMENT: NOT CLAIMED, no payment URL has been fabricated or published.
AMPLISSA: ISOLATED, no Amplissa source is compiled into DreamLedger.

## Required verification

1. Open GitHub Actions for the DreamLedger GitHub Pages workflow.
2. Require the compile, boundary checks, Pages deployment, and custom-domain probe to pass.
3. Open https://dreamledger.org/ and confirm the new DreamLedger MTG surface.
4. Open https://dreamledger.org/trust.html and confirm the transparency tiers.
5. Confirm https://dreamledger.org/mtg.html remains MTG-only.
6. Test backend login separately only after a live Node deployment is proven.

## 60-second local verification

PowerShell:

    git fetch origin
    git checkout main
    git pull --ff-only
    npm ci
    npm run build
    if (!(Test-Path dist-pages/index.html)) { throw 'Missing dist-pages/index.html' }
    if (!(Test-Path dist-pages/mtg.html)) { throw 'Missing dist-pages/mtg.html' }
    if (!(Test-Path dist-pages/trust.html)) { throw 'Missing dist-pages/trust.html' }
    if (!(Test-Path dist-pages/compiler-manifest.json)) { throw 'Missing compiler manifest' }
    Get-Content dist-pages/compiler-manifest.json

Live verification:

    curl.exe -I https://dreamledger.org/
    curl.exe -L https://dreamledger.org/ | Select-String -Pattern 'DreamLedger|MTG'

## Non-claim

A Git commit is not evidence that the website changed. This file deliberately records build, deployment, and live verification as separate states.
