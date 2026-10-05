# HANDOFF — Trinity wired

**Branch:** feat/toll-road-expansion-agent-bridge-20261005  
**Revenue claim:** NZ$0

## Wired

| Piece | Status |
|-------|--------|
| `BEC-PRIME/runtime/Trinity.js` | Elohim → Gauntlet → Bridge composition + selfCheck |
| `POST /api/toll/v1/trinity` | Paid scope `trinity` NZ$49 / 25 runs |
| Checkout | `/api/toll/v1/checkout/trinity` |
| Redeem | `/api/toll/v1/redeem/trinity` |
| Manifest | `TRINITY-RUN` advertised |
| Truth route | Tagged Elohim truth boundary |
| Docs | `AGENT_BUS/TRINITY-SYNERGY.md` |

## Synergy rules
- `BLOCKED_BY_TRUTH` if Elohim CONTRADICTED
- `BLOCKED_BY_GAUNTLET` if decision FAIL
- `ALIGNED` only when evidence not contradicted AND Gauntlet PASS

## Money (production, no deploy needed for these)
- NZ$9 https://dreamledger.org/api/toll/v1/checkout/truth
- NZ$19 https://dreamledger.org/api/toll/v1/checkout/gauntlet

Trinity NZ$49 goes live after this branch merges + deploys.

## Owner action for first cents
Share the live NZ$9/19 links. Machine cannot create the buyer.
