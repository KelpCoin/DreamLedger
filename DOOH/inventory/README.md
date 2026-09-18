# DOOH inventory management

**Status:** CAPABILITY_PROOF_ONLY — no verified DOOH revenue claimed.

Manages sellable DreamLedger DOOH units (Founding Billboard tiles and campaign slots) without calling Trillboards live booking APIs.

## States

```
AVAILABLE → HELD → SOLD → FULFILLING → COMPLETE
                ↘ EXPIRED (hold timeout)
GATED  (not sellable until human ungate — e.g. NZ$500 campaign)
```

## Rules

1. **Real scarcity** — capacity is finite; `reserve` fails when none available.
2. **No fake urgency** — remaining counts are real, not fabricated.
3. **Hold is temporary** — default hold TTL; release or expire returns capacity.
4. **Sold only after explicit mark** — payment settlement is external; inventory does not invent payment.
5. **Gated SKUs** — `DOOH-CAMPAIGN-500` stays `GATED` until `ungate_sku`.
6. **No live media buy** — Trillboards `media_buy_create` remains human-approved (see `DOOH-CUBE-001.json`).

## CLI

```bash
python DOOH/inventory/inventory.py summary
python DOOH/inventory/inventory.py reserve --sku DREAMLEDGER-BILLBOARD-NZ-100X100 --holder checkout_session_abc
python DOOH/inventory/inventory.py release --unit-id <id>
python DOOH/inventory/inventory.py mark-sold --unit-id <id> --payment-ref pi_xxx
python -m unittest DOOH.inventory.test_inventory
```

Seed file: `inventory_seed.json` (derived from `commerce/dreamledger-regional-billboard-offers.json`).
