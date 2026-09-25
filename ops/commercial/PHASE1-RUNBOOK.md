# Phase 1 commercial cell — runbook

## State is centre

```bash
python3 ops/commercial/cell_status.py
```

## Active cells

| Cell | Price | Buy |
|------|-------|-----|
| TILE-50 | NZ$50 | https://dreamledger.org/buy/DREAMLEDGER-BILLBOARD-FOUNDING-001 |
| DIAG-29 | NZ$29 | https://dreamledger.org/buy/COMMANDER-DECK-DIAGNOSTIC-001 |

Both status **authorized** → next transition is **DISTRIBUTE** (human posts URL).

## ActionPass-lite

```bash
python3 ops/commercial/actionpass.py propose --type post_buy_url \
  --params '{"buy_url":"https://dreamledger.org/buy/DREAMLEDGER-BILLBOARD-FOUNDING-001","channel":"owned"}' \
  --mission OP-PHASE1-TILE-50

python3 ops/commercial/actionpass.py authorize act_XXXX --by husband
python3 ops/commercial/actionpass.py execute act_XXXX          # dry-run
python3 ops/commercial/actionpass.py execute act_XXXX --execute
```

Money actions (`create_ad_campaign`, `spend_budget`, `stripe_refund`) always need `approved_by`.

## On payment

1. Settlement Sync / webhook verify  
2. `money_pipeline.py` ingest (verified)  
3. Fulfil (tile review / diagnostic deliver)  
4. Mark cell `won` only with external livemode evidence  

## Do not

Build Market Observer or ads before a `won` cell.
