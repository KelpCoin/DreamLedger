# DreamLedger Agent Toll Road

A machine-payable validation service for agents and software.

Paid endpoints:
- POST /v1/reconcile: $0.02
- POST /v1/contradictions: $0.02
- POST /v1/passport: $0.05

The service uses HTTP 402/x402 on Base mainnet. The payment rail is fail-closed until both X402_PAY_TO and X402_FACILITATOR_URL are configured.

The economic model is intentionally boring: agents pay for verification work, the API performs deterministic checks against durable DreamLedger state, and each paid call produces a result hash.

No self-purchases, synthetic calls, or internal activity count as revenue.

The service is designed for discovery through x402/Bazaar and MCP-compatible clients. Coinbase's x402 discovery catalog can index active x402 resources, and its Bazaar MCP server can expose paid resources to agents. See the x402 foundation specification and Coinbase Bazaar documentation for the protocol flow.
