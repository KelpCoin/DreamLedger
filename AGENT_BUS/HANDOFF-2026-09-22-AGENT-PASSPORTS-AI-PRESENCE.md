# Handoff — Agent Passports + AI Presence Experiment

Date: 2026-09-22

## Added
- BEC-PRIME/trust/AGENT-PASSPORTS.md
- BEC-PRIME/trust/AGENT-PASSPORT.schema.json
- docs/play/AI-PRESENCE-EXPERIMENT.md
- docs/play/AI-PRESENCE-STATE.schema.json

## Passport direction

Treat an agent passport as an evidence-backed trust envelope, not a self-issued reputation score.

Separate Agent Card, passport, authority, and settlement.
Agent Card describes capabilities, endpoint, protocol, and authentication requirements.
Passport records independently evidenced execution history.
Authority records what has actually been authorized.
Settlement records independently verified economic events.

Passport cannot authorize spending and cannot write revenue.

## Play direction

Single-shard PVE:
- logout human becomes approximately 10% strength ghost;
- ghost stays in the same area;
- AI population scales conservatively with active human population;
- AI uses the same legal player action surface;
- AI may form guilds under the same rules;
- optional LLM layer proposes higher-level goals;
- deterministic server remains authoritative;
- every AI action is attributable and replayable.

Initial AI cap: 5.

## Trust wedge

The public DreamLedger trust surface can eventually expose sanitized agent passports and interoperable Agent Cards while keeping secrets and private evidence out of the public face.

Economic trust chain:
agent → authority → action → transaction → fulfillment → evidence

Never:
agent claim → revenue

## Economic truth

verified_external_revenue_nzd = 0

## Next build order

1. Keep Ball C first-sale priority intact.
2. Add passport rendering only after underlying evidence references exist.
3. Implement AI presence state on the authoritative shard.
4. Run a low-N experiment.
5. Record cohort behavior and human/AI population counts.
6. Do not allow play or passport events to declare revenue.