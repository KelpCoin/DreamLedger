# MTG Agent Bridge intake

This is the first live Agent Bridge capacity test.

## North Star

Two independent human/LLM nodes must be able to submit MTG deck intake from different phones and converge on the same DreamLedger MTG silo without manually copying work between chats.

Flow:

PHONE / LLM
-> Agent Bridge
-> AGENT_BUS/BRIDGE/MTG_INTAKE
-> canonical MTG intake
-> DreamLedger /mtg
-> only after canonical acceptance may a record become HappyHomarid/public inventory.

## Human payload

For each EDH deck, the human supplies only:

- commander name
- optional deck name
- optional rough price or ?
- optional note

Do not require card-by-card enumeration.

## Canonical receipt

Every accepted submission must preserve:

- intake_id
- source_worker
- source_device
- submitted_by
- submitted_at
- canonical_destination
- truth_state
- publication_state
- raw_human_input
- normalized fields
- evidence pointer

Truth defaults to UNVERIFIED.

Publication defaults to NOT_PUBLISHED.

## Acceptance test

PASS only when:

1. phone A submits a deck;
2. phone B submits a different deck;
3. both submissions are visible from the shared canonical project state;
4. each has an attributable work receipt;
5. neither becomes public before canonical acceptance;
6. the MTG silo can enumerate both records.

A sandbox-only result is not a pass.

## Existing bridge

Use the existing Agent Bridge bus. Do not create another queue or ledger.

The existing protocol is:
AGENT_BUS/BRIDGE/PROTOCOL.md

The existing shared state is GitHub AGENT_BUS plus the canonical MTG data layer.

Revenue remains NZ$0 until independently verified settlement evidence exists.
