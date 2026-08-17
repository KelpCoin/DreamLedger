# LM Studio Multi-LLM Iterative Refinement Contract

## Local plane

LM Studio is the preferred local execution plane when the Windows GPU is available.

Recommended loop:

PROPOSER -> CRITIC -> SYNTHESIZER -> GAUNTLET -> PROOF

The models are interchangeable. The contract matters more than the model name.

Each pass must preserve:

- silo boundaries
- approval gates
- evidence-before-claim rules
- no fabricated revenue
- no fabricated deployment
- no secret leakage

## Cloud continuity plane

When the PC is off, GitHub Actions can execute refinement through an explicitly configured OpenAI-compatible API endpoint.

Required repository secrets for cloud refinement:

- LLM_API_URL
- LLM_API_KEY
- LLM_MODEL

The endpoint must be supplied by the operator. This repository does not assume a provider or hard-code credentials.

## Iterative protocol

Pass 1: proposer generates candidate improvements.
Pass 2: critic attacks the candidate for correctness, security, economic truth and silo leakage.
Pass 3: synthesizer produces the smallest safe patch proposal.
Pass 4: Gauntlet validates the repository state.
Pass 5: proof records the result.

No refinement pass is permitted to turn an unverified economic event into revenue.

## Local-first rule

LM Studio itself is not expected to run inside GitHub Actions. GitHub Actions is the PC-off continuity plane. Local LM Studio remains the preferred GPU-backed plane when available.
