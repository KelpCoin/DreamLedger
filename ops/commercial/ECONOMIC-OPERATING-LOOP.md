# DreamLedger economic operating loop

**Executable companion:** `PHASE1-RUNBOOK.md`, `actionpass.py`, `cell_status.py`, `cells/`

State is the centre. Agents are replaceable workers. Models are interchangeable.

```
Market → Opportunity → Offer → Acquisition → Payment → Fulfilment
→ Evidence → Learning → Next opportunity
```

## Phase 1 (now)

Two authorized cells in `cells/`. Next transition: **human posts buy_url**.

```bash
python3 ops/commercial/cell_status.py
```

## Seven workers (roles, not a fleet to clone)

1. Market Observer — later  
2. Opportunity Engine — JSON cells now  
3. Offer Engine — catalog + Payment Links  
4. Acquisition — human channel now  
5. Payment — Stripe oracle + money_pipeline  
6. Fulfilment — dispatch docs  
7. Truth Oracle / Learning — evidence classes; after first win  

## ActionPass

`actionpass.py` — propose / authorize / execute (dry-run default).

## Full desk

See also `POLSIA-DREAMLEDGER-GAP-MATRIX.md`. Do not build ten agents.
