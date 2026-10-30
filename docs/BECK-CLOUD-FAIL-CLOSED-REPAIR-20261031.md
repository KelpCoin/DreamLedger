# BECK cloud-only fail-closed repair proposal, 31 Oct 2026

Status: DRAFT REVIEW / NOT DEPLOYED / NOT PRODUCTION CERTIFIED. Local PC, GPU and LM Studio are not required.

## Observed GitHub failures

- Cloud Primary run: https://github.com/KelpCoin/DreamLedger/actions/runs/41058599776 and Integration Truth run: https://github.com/KelpCoin/DreamLedger/actions/runs/41058599707 both fail when the compile verifier reads missing API source. The inspected main also lacks two adjacent checkout/webhook handlers.
- Factory run: https://github.com/KelpCoin/DreamLedger/actions/runs/41058454979 and Settlement Sync: https://github.com/KelpCoin/DreamLedger/actions/runs/41053911268 cannot reconcile without the GitHub runner Stripe credential.
- Production Heartbeat: https://github.com/KelpCoin/DreamLedger/actions/runs/41057776814 cannot self-heal without the deployment-provider credential. Its production contract fails.

## Changes proposed

1. Existing source verifier writes JSON with named missing files, retains cross-silo forbidden-token checks, and exits nonzero instead of throwing ENOENT. No missing handlers are fabricated.
2. Existing cloud build and integration workflows upload that proof even when compilation stops.
3. One tiny credential-presence gate checks for nonempty runner environment values and never logs the values. Missing yields HOLD_MISSING_CREDENTIAL with a nonzero exit and artifact. Present yields CONFIGURED_NOT_AUTHENTICATED, not proof of credential validity.
4. Existing settlement/factory workflows check this gate before reconciliation and upload proof even on failure. No new Stripe calls or payment mutations.
5. Existing heartbeat records nonsecret recovery HOLD evidence if the deployment credential is unavailable; its final health gate stays fail-closed.
6. Node standard-library tests cover missing/present credentials without disclosure, missing API handlers and forbidden cross-silo tokens.

## Still blocked after this draft

- Missing API handlers remain missing. Do not treat the canonical compile as repaired until real, tested and approved implementations exist.
- Runner secret configuration and valid provider scope are not addressed by this PR. No credentials are created, rotated, pasted, printed or copied.
- No permission to merge, publish, deploy, trigger a checkout, change a payment object or release a production clone is implied.
- No production RLS, source inventory, settlement, fulfillment, deploy drift or independent paid-and-delivered order is established by this draft.

## Verifier and proof

A GitHub-hosted runner may run:

node --test ops/cloud/credential-gate.test.cjs BEC-PRIME/scripts/Verify-MoltBeachMVP.test.cjs

Review artifacts on Cloud Primary, Integration Truth, Factory Factory, Commerce Settlement Sync and Production Heartbeat. The status must remain HOLD or FAIL until underlying blockers actually close. This is evidence plumbing, not a green production gate. Commercial revenue baseline is unchanged.
