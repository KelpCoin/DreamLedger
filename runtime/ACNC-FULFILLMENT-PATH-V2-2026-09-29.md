# ACNC FULFILLMENT PATH V2 - 2026-09-29

## Implemented

The existing ACNC_RESEARCH_WORKER was advanced from research-only output to a deterministic deliverable-generation stage.

Supabase function:
- project: wbwgroygjeyukkspnqiy
- function: acnc-research-worker
- version: 2
- status: ACTIVE
- JWT verification: enabled

## New live capability

The worker now:
1. Fetches the current ACNC Registered Charities dataset.
2. Filters by state and keyword.
3. Produces a fixed buyer-facing deliverable schema.
4. Preserves charity public contact fields where present.
5. Emits an ACNC register URL keyed by ABN for each record.
6. Generates a complete CSV payload suitable for spreadsheet import.
7. Runs deterministic validation over the output.
8. Explicitly counts unresolved decision-maker records.
9. Refuses to infer or fabricate decision-maker identities/contact details.

## Current terminal state

The worker's fulfillment status remains:

BLOCKED_ON_DECISION_MAKER_ENRICHMENT

This is intentional. Spreadsheet generation and validation are now executable. Responsible Person / decision-maker enrichment is still not proven.

## External source basis

The ACNC states that the public Charity Register contains Responsible Person names and positions, while personal contact information for Responsible People is not generally published. The public register can also contain charity-level email, phone and website information.

Therefore the missing capability must distinguish:
- Responsible Person identity/position from the ACNC public register.
- Public professional contact information from an authoritative public source.
- Charity-level contact information, which must not be mislabeled as a person's contact.

## No economic claims

No proposal submission, buyer acceptance, paid order, fulfillment, payment or revenue is claimed.

## Next implementation target

Build the bounded public-source enrichment worker:
ACNC ABN
-> ACNC register record
-> Responsible Person name/position
-> authoritative public organization/person contact source
-> confidence/source URL
-> validation
-> final CSV

Promotion to COMPLETE_FULFILLMENT is forbidden until a real WA sample passes the entire chain.
