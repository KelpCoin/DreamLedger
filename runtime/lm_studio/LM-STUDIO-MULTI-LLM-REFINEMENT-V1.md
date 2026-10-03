# LM Studio Multi-LLM Iterative Refinement v2

The local refinement loop requires three distinct local model identities.

`CREATOR -> CRITIC/VISION -> SYNTHESIS`

The minimum viable panel is three models. The CRITIC role is the designated visual/OCR role when image inputs are supplied.

## Required model configuration

Set three distinct exposed model identifiers:

- DREAMLEDGER_CREATOR_MODEL
- DREAMLEDGER_CRITIC_MODEL
- DREAMLEDGER_SYNTHESIS_MODEL

Optional:

- DREAMLEDGER_VISION_MODEL

When DREAMLEDGER_VISION_MODEL is set, it must equal one of the three configured models. By default the CRITIC model is the visual model.

The orchestrator refuses to start when fewer than three distinct models are configured or exposed. It never silently assigns one model to multiple roles.

Legacy variables may supply role values when the new role-specific variables are absent, but the final assignments must still be three distinct models.

## Iteration

Each round performs three model calls:

1. CREATOR constructs or expands the bounded internal artifact.
2. CRITIC attacks it and performs visual inspection/OCR when images exist.
3. SYNTHESIS reconciles the supported corrections.
4. Repeat for the configured maximum rounds or until materially unchanged.

Gauntlet and economic-truth boundaries remain outside model consensus. Consensus cannot create truth, authorization, payment or revenue.

## 16 GB GPU operating rule

Three models must be installed. They do not need to be simultaneously resident. The Windows worker loads one role model, runs it, unloads it, then loads the next. This keeps VRAM usage bounded while preserving three distinct model cognition paths.

LM Studio exposes model discovery through `/v1/models` and model management through `lms`. The worker verifies model availability before inference.

## Image inputs

Set `DREAMLEDGER_VISION_IMAGE_PATHS` to a semicolon-separated list of local PNG, JPEG or WebP files. Images are supplied only to the designated visual model during CRITIC.

LM Studio documents VLM image input for PNG, JPEG and WebP and supports OpenAI-compatible text-and-image chat requests.

## Economic rule

More models strengthen creation, criticism and synthesis. They do not create revenue. Independent external payment, attribution, fulfillment and proof remain the only economic truth gate.
