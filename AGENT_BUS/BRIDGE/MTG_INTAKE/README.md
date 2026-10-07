# MTG Agent Bridge

The MTG bridge uses the existing DreamLedger Agent Bridge bus. It does not create a second queue or ledger.

Human/LLM flow:

PHONE → GROK → AGENT_BUS/BRIDGE/MTG_INTAKE/inbox → intake workflow → canonical MTG record → work receipt → downstream MTG workers.

The human supplies the facts. Grok normalizes the voice/text input and writes the submission. The intake workflow assigns the canonical MTG id and records evidence.

The first downstream worker is the primer worker. It reads the canonical deck record and writes the primer back to the same deck workspace. Later workers may consume the primer for deck analysis, Monte Carlo experiments, ComfyUI media generation and publication preparation.

Public publication is a separate stage. Intake and enrichment do not publish anything.

See:
- PROTOCOL.md for the existing Agent Bridge protocol.
- inbox/README.md for the phone/Grok workflow.
- data/schema/mtg-agent-bridge-intake-v1.json for the canonical record contract.
- data/schema/mtg-agent-bridge-submission-v1.json for the low-friction submission contract.
- BEC-PRIME/scripts/ingest-mtg-bridge.js for deterministic ingestion.
- .github/workflows/mtg-intake.yml for the automatic intake trigger.

## The only thing Grok needs to do

When the human says:

"Submit this deck to the DreamLedger MTG Agent Bridge."

Grok should write one submission JSON file into:

AGENT_BUS/BRIDGE/MTG_INTAKE/inbox/

The submission must preserve the dictated decklist exactly when one is supplied. Grok must not invent missing cards, prices, condition or commander identity.

The workflow creates:

MTG-#### canonical record
+
WR-MTG-#### work receipt

with:

truth_state = UNVERIFIED
publication_state = NOT_PUBLISHED
next_stage = MTG_PRIMER

Nothing is automatically posted to Facebook, HappyHomarid, Patreon or a marketplace by the intake workflow.
