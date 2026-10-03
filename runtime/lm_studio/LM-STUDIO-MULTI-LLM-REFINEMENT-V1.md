# LM Studio Multi-LLM Iterative Refinement v2

The local refinement loop requires three distinct local model identities.

`CREATOR -> CRITIC/VISION -> SYNTHESIS`

The minimum viable panel is three models. The CRITIC role is also the designated visual/OCR role when image inputs are supplied.

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

1. CREATOR constructs or expands the bounded candidate, artifact or execution plan.
2. CRITIC attacks the creator output. When image inputs exist, the designated vision model performs visual inspection/OCR.
3. SYNTHESIS reconciles the creator and critic outputs and emits the next evidence-backed state.
4. Repeat for the configured maximum rounds or until materially unchanged.

Gauntlet and economic-truth boundaries remain outside model consensus. Consensus cannot create truth, authorization, payment or revenue.

## 16 GB GPU operating rule

Three models must be installed. They do not need to be simultaneously resident in VRAM. The Windows worker may load the active role model sequentially and use lms load with GPU offload. This avoids assuming that three model weights plus context will fit concurrently.

LM Studio exposes loaded-model state through lms ps and model discovery through /v1/models. The worker must verify both before inference.

## Image inputs

Set DREAMLEDGER_VISION_IMAGE_PATHS to a semicolon-separated list of local PNG, JPEG or WebP files. Those images are supplied only to the designated vision model during the CRITIC stage.

PDFs should be converted to page images by the existing document pipeline before visual inspection.

LM Studio documents VLM image input for JPEG, PNG and WebP and supports OpenAI-compatible text-and-image chat requests.

## Economic rule

More models strengthen creation, criticism and synthesis. They do not create revenue. Only independent external payment, attribution, fulfillment and proof can change verified economic truth.
