# DreamLedger Deterministic Quote Verification Primitive

Minimal closed-loop machine-commerce primitive:

agent -> HTTP 402 -> x402 USDC on Base -> deterministic verification -> canonical evidence hash -> receipt

Paid route: POST /api/verify-quote

Default price: $0.02 USDC

Network: eip155:8453 (Base mainnet)

Runtime configuration:
- PAY_TO: existing EVM receiving address. No private key belongs in this service.
- X402_PRICE: defaults to $0.02.
- X402_FACILITATOR_URL: defaults to https://x402.org/facilitator.

Truth boundary:
- 402 is not revenue.
- A successful verification is not revenue by itself.
- Settlement evidence must be observed before payment is recorded.
- Existing DreamLedger settlement/fulfillment truth remains authoritative.
- Factorium publication is downstream and cannot manufacture commerce.

The deterministic core uses canonical JSON plus SHA-256. It rejects mixed currencies unless an FX normalization is supplied and uses a stable amount/supplier tie-break.

The Bazaar discovery extension is emitted in the x402 payment requirements. Current x402 documentation describes Bazaar as the discovery layer for x402 resources.

Deployment blocker:
PAY_TO is the only required runtime configuration not present in source. Do not commit a private key.
