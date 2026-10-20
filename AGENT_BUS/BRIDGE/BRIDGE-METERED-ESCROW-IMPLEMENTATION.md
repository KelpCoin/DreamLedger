# Metered Inference and Escrowed Async Tasks: Implementation Gate

Date: 2026-10-20
Branch: feat/bridge-metered-escrow-proof-20261020

## Existing baseline inspected

- The existing canonical bridge entry point is `BEC-PRIME/runtime/AgentBridge.js`, which loads `AgentBridgeFencedAdapter.js`.
- The existing economic toll-road is `supabase/functions/agent-toll-road/index.ts`.
- That toll-road currently imports `registerExactEvmScheme` and registers fixed-price routes. It does not register the EVM `upto` scheme.
- The function defaults to Base Sepolia unless `X402_TESTNET=false`; a mainnet result must be verified from the actual network and transaction receipt.
- The existing MCP gateway policy is local stdio-only and proposal-only. This change does not expose Gauntlet, Judge, shell execution, payment credentials, or any additional MCP tools.

## Metered price contract

Maximum authorization: 0.10 USDC.
Rate: 0.0001 USDC per generated output token.
Calculation is done in integer USDC atomic units (six decimals), not binary floating point:

- 100 generated tokens: 10,000 atomic units = 0.01 USDC.
- 900 generated tokens: 90,000 atomic units = 0.09 USDC.
- 1,000 or more generated tokens: capped at 0.10 USDC.

Therefore an assertion that 100 generated tokens charge 0.09 USDC conflicts with the stated rate. Tests in this branch make the arithmetic explicit rather than encoding the contradictory expectation.

The x402 `upto` scheme authorizes a maximum and lets the server set the final amount after execution. The current EVM specification uses Permit2 and a facilitator; do not describe this EVM flow as facilitator-free. The route must set the settlement override using server-measured usage, and the override must not exceed the advertised cap.

## Escrow contract boundary

A database state machine is not an escrow. The state helper added here requires funding transaction evidence before queueing, delivery and reviewer evidence before release, and an on-chain release or refund transaction hash for terminal money movement. It allows five requested revisions before the following rejection leads to REFUND_PENDING.

The HTTP endpoint that creates and funds real escrow is intentionally not enabled by this branch alone. Before enabling it, select an actual deployed contract, verify its chain ID/address/ABI and supported token, specify buyer/provider/evaluator roles, deadlines and dispute/timeout behavior, and run contract tests plus a testnet lifecycle. No contract deployment, wallet signing, or payment is performed by these changes.

## Local inference boundary

A Supabase Edge Function cannot call a user's LM Studio process at `127.0.0.1:1234`; that address would resolve to the cloud runtime. A paid inference route needs a reachable, authenticated execution adapter, or a local worker that polls a durable queue and returns a signed/correlated result. The runtime must use server-measured usage and hash the exact delivered payload bytes. This branch does not invent a worker URL or tunnel.

## Discovery and publishing

`ops/commerce/bridge-metered-agent-card.proposed.json` is a private proposal. It is not written under `public/` and has not been published to agentsvc, FiatDock, or any other marketplace. Price discovery must not claim availability until the route can complete a real paid call. Public publication remains gated on an operational route and verifiable payment/delivery proof.

## Evidence status

`proof/bridge/BRIDGE_SETTLEMENT_PROOF.json` is deliberately BLOCKED / NOT_RUN where evidence is absent. A 402 challenge, mocked settlement, unit test, testnet transaction, or fabricated transaction hash is not a verified external sale. The delivery hash verifier calculates SHA-256 from response bytes; it does not trust a model's self-reported hash. The revenue-recognition field remains false until external settlement, attribution, fulfillment, and independent evidence reconcile under the DreamLedger commercial truth rules.

## Verification

Run from the repository root with Node.js 20 or later:

```powershell
node --test BEC-PRIME/runtime/BridgeSettlementModels.test.js
```

This command exercises only deterministic helper logic. It does not test chain settlement, inference-provider connectivity, the escrow contract, or a production endpoint.
