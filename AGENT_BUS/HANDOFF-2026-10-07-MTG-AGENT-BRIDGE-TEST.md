# HANDOFF - MTG Agent Bridge capacity test

## OBSERVED

The existing Agent Bridge v1.1 already provides a shared Git-backed bus across air-gap/cloud/hybrid workers. The existing MTG Master Silo has a canonical intake table, while PR #476 defines the Supabase-backed deck catalog but remains blocked on independent production schema verification.

## CHANGED

Added the MTG-specific Agent Bridge intake contract:

- AGENT_BUS/BRIDGE/MTG_INTAKE/README.md
- data/schema/mtg-agent-bridge-intake-v1.json

The contract deliberately reuses the existing Agent Bridge bus. It does not create a second queue, ledger, or orchestration system.

## TEST

Phone A and Phone B must each submit one EDH deck using the same contract.

Required proof:
PHONE -> AGENT BRIDGE -> SHARED CANONICAL STATE -> MTG SILO

HappyHomarid/public publication is forbidden until canonical acceptance.

## NEXT

1. Wife's LLM submits MTG-0001 through GitHub/Agent Bridge.
2. Biggie's LLM submits MTG-0002 through the same bridge.
3. A worker/processes the shared bus and records canonical MTG intake.
4. Verify both records from independent readers.
5. Only then enable downstream MTG/HappyHomarid publication.

Verified external revenue remains NZ$0.
