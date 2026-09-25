# Economic loops (ecosystem)

## What a loop is

```
DISCOVER → OFFER → DISTRIBUTE → AUTHORIZE → PAY → SETTLE → FULFIL → PROOF → LEARN → REPEAT
```

Closed only when **PAY through PROOF** succeed for an **external** buyer.

## Files

| Path | Role |
|------|------|
| `registry.json` | All loops, stages, faces, wiring |
| `instances/` | Running loop instances |
| `instances/_TEMPLATE.json` | Copy shape |

## Commands

```bash
# Start a tile loop instance (after you decide to push demand)
python3 scripts/loop_instance_new.py LOOP-BILLBOARD-FOUNDING-50 --stage DISTRIBUTE

# After someone pays (example)
python3 scripts/loop_instance_advance.py inst-... --to PAY --session cs_live_xxx --external-buyer --amount 50
python3 scripts/loop_instance_advance.py inst-... --to SETTLE
python3 scripts/loop_instance_advance.py inst-... --to FULFIL
python3 scripts/loop_instance_advance.py inst-... --to PROOF
```

`counts_as_verified_revenue` flips true only when external + settled + fulfilled + proof + session + amount.

## Primary loops (money)

1. `LOOP-BILLBOARD-FOUNDING-50`  
2. `LOOP-CMD-DIAG-29`  

Everything else supports or waits.
