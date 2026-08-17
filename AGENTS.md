# DreamLedger Ecosystem Integration Map

Date: 2026-08-17

## Accessible repositories indexed

- KelpCoin/index.html - static landing/site asset - engineering
- KelpCoin/kelpcoin-faucet-site - static faucet site - engineering
- KelpCoin/safehub - Flask/Python application - engineering
- KelpCoin/carousel-catalog - catalog surface - cash/commercial candidate
- KelpCoin/pulse-catalog - catalog/discovery surface - cash/commercial candidate
- KelpCoin/DreamLedger - primary commercial/application repository - cash lane + engineering
- KelpCoin/render-ingestor - render pipeline - engineering
- KelpCoin/mtg-furnace-render - MTG rendering pipeline - engineering/MTG
- KelpCoin/Happyhomarid - HappyHomarid site - siloed product
- KelpCoin/DreamLogic - verification/logic repository - engineering/spec
- KelpCoin/BrownEye-CUBE - CUBE repository - frozen/spec unless explicitly unlocked

## Existing workflow evidence

DreamLedger has an existing workflow set including acquisition-proof-gate.yml, bec-auto-compile.yml, bec-prime-autonomous-operator.yml, bec-prime-gates.yml, bec-prime-mission-loop.yml, bec-prime-pc-off-operator.yml, bec-runtime-proof.yml, bec-worker-dispatch.yml, cloud-fallback-economic-watch.yml, commerce-sentinel.yml, create-payment-link.yml, cube-verify-lite-proof.yml, deploy.yml, and dreamiez-account-live-proof.yml.

render-ingestor has full-cortex-pipeline.yml.
DreamLogic has verify.yml.
The other indexed repositories checked during this pass did not expose .github/workflows on main.

## Frozen boundaries

CUBE is frozen unless explicitly unlocked.
UPF is frozen unless explicitly unlocked.
No integration workflow may modify CUBE/UPF.
MTG/HappyHomarid and adult/Amplissa lanes remain siloed.

## Cash lane

Primary commercial repository: KelpCoin/DreamLedger.
Current billboard checkout: https://buy.stripe.com/28EcN54zraG13M3g3idwc1t
Current offer: DreamLedger permanent 100x100 billboard block, NZ$29.

## Economic truth

VERIFIED_ECONOMIC_OUTPUT_NZD = 0
VERIFIED_PAYMENT_COUNT = 0

Revenue remains NZ$0 until Stripe independently confirms a paid transaction. CI status, GitHub commits, page existence, clicks, or plans do not count as revenue.

## Verification

Local proof verifier: REVENUE-TRUTH-VERIFIER.ps1
Integration CI: .github/workflows/integration-spine.yml

The integration spine does not deploy to Vercel and does not call external services.
