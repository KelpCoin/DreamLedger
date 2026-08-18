# LM Studio Council Research - 2026-08-18

## Decision

Use LM Studio as the local inference plane and BrownEye as the orchestration, memory, governance, commerce, and proof plane.

Preferred council roles:

- Proposer: Qwen3 14B when installed.
- Critic: DeepSeek R1 Distill Qwen 14B when installed.
- Synthesizer: GPT-OSS 20B when hardware permits; otherwise Qwen3 14B.
- Visual critic: Gemma 3 12B when installed.
- Coder: Qwen3 Coder 30B only when system memory permits; otherwise Qwen3 14B.

These are role preferences, not hard-coded requirements. The bootstrap must discover installed models and select the best available match.

## Cost

LM Studio local inference is currently listed as Free ($0). Local models run on the user's machine and do not consume LM Studio cloud credits. Cloud models are separately billed through credits. Therefore the local council has no token/API spend, but it still has electricity, hardware, RAM, VRAM, thermals, and wall-clock costs.

## Runtime strategy

The BrownEye default is sequential role execution: load one model, execute one role, persist the result, unload the model, then continue. This is the preferred energy and VRAM strategy for constrained hardware.

LM Studio also supports multiple model instances and parallel inference. Parallel execution should be treated as an optional high-memory throughput mode, not the baseline for an 8 GB-class GPU.

LM Studio's native v1 REST API provides model discovery, chat, load, and unload endpoints. JIT loading is also available for inference endpoints, but BrownEye should prefer explicit load/unload when it needs deterministic resource accounting and proof.

## Current official evidence

- LM Studio pricing: https://lmstudio.ai/pricing
- LM Studio local/offline operation: https://lmstudio.ai/docs/app/offline
- LM Studio REST API: https://lmstudio.ai/docs/developer/rest
- LM Studio model load: https://lmstudio.ai/docs/developer/rest/load
- LM Studio model unload: https://lmstudio.ai/docs/developer/rest/unload
- LM Studio headless/JIT operation: https://lmstudio.ai/docs/developer/core/headless
- LM Studio model management: https://lmstudio.ai/docs/python/manage-models/loading
- LM Studio 0.4.0 parallel inference: https://lmstudio.ai/changelog/lmstudio-v0.4.0

## BrownEye implementation contract

The council is not the economic authority.

- Settlement authority remains the configured payment rail.
- Revenue remains zero until external payment evidence exists.
- Public publication remains approval-gated.
- Credentials, payment secrets, and customer PII are excluded from council memory.
- Council memory is append-only JSONL under D:\BrownEyeCortex\ARTIFACTS\LM-COUNCIL\MEMORY.
- Every council execution produces a proof artifact and a log.

## Blind spot found and closed

LM Studio's unload endpoint requires an instance_id. A council implementation that merely sends a model ID to the unload endpoint is not a deterministic unload contract. Future BrownEye council runners must capture the instance_id returned by /api/v1/models/load and use that exact identifier for /api/v1/models/unload.

## Energy rule

For constrained local hardware, optimize for total useful work per watt-hour rather than raw parallel throughput. The default loop is therefore:

discover -> select roles -> load -> infer -> persist proof/memory -> unload -> next role

Parallel multi-model execution is an escalation path when measured throughput justifies its higher memory and power footprint.
