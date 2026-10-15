# Tri-LLM Worker Contract

Status: proposed implementation on an isolated feature branch. This worker must remain separate from payment routes.

- Bind only to LM Studio loopback (`127.0.0.1`), default port `1235`.
- Require the three distinct aliases `scout`, `critic`, and `vision`; never duplicate a missing model to make the count reach three.
- Require explicit, schema-valid verdicts from all stages. Invalid JSON, unavailable endpoints, schema failures, disagreement, or missing context must fail closed.
- Record input SHA-256, model IDs, prompt versions, policy/context versions, timestamps, each output, and deterministic check results in a canonical versioned receipt.
- A receipt hash proves integrity only. Model consensus does not establish truth, payment settlement, or fulfillment.
- No x402 route, Stripe route, production configuration, or fulfillment state may be changed by the local worker.

## Local test

The test harness must use mocked responses by default and never require a live model for unit tests. A separate opt-in smoke test may call the configured LM Studio loopback endpoint. It must not bind a new listener or expose LM Studio to the network.
