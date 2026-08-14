# BEC Prime Worker Pool

This layer turns the control-plane architecture into an executable queue-driven worker contract.

Workers are replaceable. The job record is durable. The executor is untrusted. The deterministic verifier decides whether an artifact may advance.

Supported worker classes:

- `local-lmstudio`: local OpenAI-compatible LM Studio endpoint.
- `github-actions`: cloud execution through GitHub Actions.
- `self-hosted-windows`: future Windows runner using the same job contract.
- `gpu`: future GPU worker using the same job contract.

Money, public posting, production mutation, and checkout creation remain approval-gated. The worker pool can propose and build, but it cannot self-authorize irreversible external effects.
