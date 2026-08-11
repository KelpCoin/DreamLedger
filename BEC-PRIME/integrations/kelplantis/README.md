# Kelplantis Integration

This adapter is contract-first. No live Kelplantis API is assumed or invented.

## Runtime

The local implementation runs on the desktop and uses LM Studio as the cognition layer. LM Studio exposes OpenAI-compatible endpoints on `http://localhost:1234/v1` by default.

## Environment

- `KELPLANTIS_BASE_URL`: optional future Kelplantis HTTP base URL. Leave unset until an authoritative endpoint exists.
- `KELPLANTIS_API_KEY`: optional secret. Never commit it.
- `LMSTUDIO_BASE_URL`: defaults to `http://localhost:1234/v1`.
- `LMSTUDIO_MODELS`: comma-separated model IDs. The runner discovers available models from `/v1/models` when omitted.

## Boundary

DreamLedger sends only explicit integration payloads. The adapter does not publish, charge, approve offers, or mutate payment state. Those remain human-gated.

## Flow

`task -> local LM Studio workers -> consensus artifact -> Kelplantis adapter -> approval queue`

The adapter returns `external_blocked` when no real Kelplantis endpoint is configured. This is deliberate: an unknown external system must never be represented as live.
