# DreamLedger MTG Release Gate - 2026-08-25

Status: DEPLOYMENT VERIFICATION PENDING

## What changed

The canonical Render release workflow now has an explicit production convergence gate.

The gate requires:

1. Canonical tests to pass.
2. Canonical compile to pass.
3. Public surface verification to pass.
4. Silo verification to pass.
5. Commercial integration verification to pass.
6. `verify-production-version.js` to identify the expected Git commit at `https://dreamledger.org/version`.
7. `/mtg`, `/mtg/`, `/MTG`, `/MTG/`, `/version`, `/api/products`, and `/api/products/EDH_0001` to return HTTP 200.
8. The live `/mtg` HTML to contain the MTG commerce marker and `BUY NOW`.

## Critical truth rule

A Git commit is not production proof.
A Render deployment request is not production proof.
A successful build is not production proof.

Production is PASS only after the live runtime reports the expected commit and the required MTG routes independently verify.

## Latest gate commit

54c3af6cf82f4507761d367c557bea690c8de7ab

## Revenue boundary

No live payment was created or fabricated by this change.
The first genuine paid Stripe transaction remains the economic ignition event.

## Local verifier

From the repository:

`node BEC-PRIME/scripts/verify-production-version.js`

With an explicit target:

`$env:EXPECTED_COMMIT='54c3af6cf82f4507761d367c557bea690c8de7ab'; node BEC-PRIME/scripts/verify-production-version.js`

## Human gate

Do not scan the 90 EDH decks until the production gate passes and one real checkout has been independently tested.
