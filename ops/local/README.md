# Local Money Orchestrator

Purpose: run a low-cost local supervisor against an OpenAI-compatible LM Studio server.

Architecture:

LM Studio -> orchestrator -> deterministic workers -> evidence -> supervisor gate

The LLM proposes and prioritizes. Deterministic code verifies. No LLM output is treated as revenue truth.

Default LM Studio endpoint: http://127.0.0.1:1234/v1

Start:

powershell -ExecutionPolicy Bypass -File .\ops\local\Start-MoneyLoop.ps1

The loop writes work packets and results under .\ops\local\runtime\.

High-value workers are intentionally narrow:
- storefront health/conversion checks
- offer/catalog consistency
- Stripe proof readiness checks
- PHINHAVEN recovery reconnaissance

The supervisor fails closed on payment, attribution, fulfillment, and evidence claims.
