# MTG intake drop

This directory is the low-friction handoff point for Grok and other authorised workers.

## Human workflow

The human does only this:

1. Open Grok on the phone.
2. Dictate the deck information and, if available, the decklist.
3. Tell Grok to submit it to the DreamLedger MTG Agent Bridge.
4. Grok writes one JSON submission into this directory.
5. The MTG intake workflow validates it, assigns the canonical MTG id, creates the work receipt and moves the raw submission to `processed/`.

No website form, Airtable entry, Supabase entry, GitHub clicking, card-by-card pricing or public posting is required at intake.

## Required submission shape

```json
{
  "schema": "dreamledger/mtg-agent-bridge-submission/v1",
  "source_worker": "GROK",
  "source_device": "WIFE_PHONE",
  "submitted_by": "WIFE",
  "commander": "Commander name",
  "deck_name": "Optional deck name",
  "ballpark_price_nzd": null,
  "notes": "Optional notes",
  "decklist_text": "Optional full dictated/pasted decklist"
}
```

Use `null` for unknown values. Do not invent a price, condition, commander or card.

## What happens next

`inbox/*.json`
→ validation
→ `canonical/*.json`
→ `receipts/*.json`
→ `processed/*.json`
→ downstream `MTG_PRIMER` worker

Canonical intake defaults to:

- truth_state: `UNVERIFIED`
- publication_state: `NOT_PUBLISHED`
- canonical_destination: `DREAMLEDGER_MTG`

The intake workflow never publishes to Facebook, HappyHomarid, the DreamLedger public site or another marketplace.

## Grok instruction

When the human says "submit this deck to the DreamLedger MTG Agent Bridge", read this contract and write exactly one JSON file to:

`AGENT_BUS/BRIDGE/MTG_INTAKE/inbox/`

Filename:

`submission-<unique-id>.json`

The unique filename can be an ISO timestamp or another collision-resistant value. Do not put the submission in `canonical/` or `processed/` yourself.
