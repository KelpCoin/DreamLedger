# Silo CTA cards — clean presentation rule

Each silo on a compiled face gets **one primary CTA card** (not a wall of links).

## Card fields

| Field | Rule |
|-------|------|
| silo_id | From CUBE-SILO-REGISTRY |
| title | Human label |
| one_liner | ≤ 140 chars |
| primary_cta_label | Single verb phrase |
| primary_cta_href | Route or checkout |
| economic_loop_id | Optional; only if live loop exists |
| status | live \| slot \| gated |

## Examples (disk intent)

| Silo | Primary CTA |
|------|-------------|
| dreamledger | Claim founding tile · NZ$50 |
| mtg | Deck diagnostic · NZ$29 |
| dreammeez | Open DreamMeez |
| play / phinhaven | Enter First Garden |
| digital-products | Browse kits |
| truth-oracle | Ask the Oracle |
| empty NZ-AU slots | “Opening soon” — no fake inventory |

## Compiler

Future face compiler maps `silo_slots` + live loops → CTA cards.  
Manual HTML faces are legacy.
