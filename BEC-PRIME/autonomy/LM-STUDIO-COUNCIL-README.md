# BrownEye Local LM Studio Council

This is the local inference plane for DreamLedger/BrownEye. It is deliberately sequential rather than five-models-loaded-at-once.

LM Studio exposes OpenAI-compatible endpoints and a native stateful chat API. The bootstrap probes the local `/v1/models` endpoint, assigns installed models to roles, and writes a persistent JSONL memory ledger outside the repository.

## Recommended role stack

- Proposer: Qwen3 14B when installed. It supports reasoning and non-thinking modes and is a strong general instruction/coding candidate.
- Critic: DeepSeek R1 Distill Qwen 14B when installed. It is explicitly tuned for reasoning.
- Synthesizer: GPT-OSS 20B when memory permits; otherwise Qwen3 14B. GPT-OSS 20B is an agentic, tool-using MoE model designed for local deployment.
- Visual critic: Gemma 3 12B when installed. It accepts image input and is useful for storefront/screenshot review.
- Coder: Qwen3 Coder 30B when the machine has enough system memory; otherwise Qwen3 14B.

These assignments are preferences, not hard-coded model IDs. `Bootstrap-LMStudioCouncil.ps1` discovers what is actually installed and chooses the first matching model.

## Resource strategy

Do not keep every council member resident. Load one model, execute its role, persist the result, unload it, and load the next. This makes the council useful on constrained hardware and avoids turning the GPU into a space heater with a business plan.

For a machine with roughly 8 GB VRAM, the practical default is 7B-14B class models with CPU/RAM offload as required. For a 16 GB+ system, GPT-OSS 20B becomes much more attractive. Qwen3 Coder 30B and larger models should be treated as high-memory options. LM Studio's catalog currently lists GPT-OSS 20B at about 12 GB model size and Qwen3 Coder Next at about 42 GB minimum system memory, so those are not sensible baseline assumptions for a small GPU.

## Persistent memory contract

Memory is append-only JSONL under `D:\BrownEyeCortex\ARTIFACTS\LM-COUNCIL\MEMORY`. Store decisions, evidence references, artifact paths, model/role, timestamps and confidence. Never store credentials, payment secrets or customer PII.

The council does not become an economic authority. Stripe remains settlement authority. Public publication remains approval-gated. Revenue remains zero until external payment evidence exists.

## 60-second verification

```powershell
powershell -ExecutionPolicy Bypass -File .\BEC-PRIME\scripts\Bootstrap-LMStudioCouncil.ps1
Get-Content D:\BrownEyeCortex\ARTIFACTS\LM-COUNCIL\LM-COUNCIL-BOOTSTRAP-PROOF.json
```

Expected result: `status` is `PASS`, `visible_model_count` is greater than zero, and a role assignment/configuration is written to disk.
