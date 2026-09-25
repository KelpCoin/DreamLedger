# HANDOFF — Commercial Phase 0 (Polsia-corrected)

## OBSERVED

Research correction: Polsia = scheduled agents + APIs; DreamLedger needs money pipe + evidence, not a clone. Prior design overclaimed ActionPass/actuators as done.

## CHANGED

- `ops/commercial/*` schema, state machine, money_pipeline.py, fixtures, lessons
- Explicit: LLM not payment authority

## NEXT

1. Wire production webhook → `verify_stripe_event` → ingest path  
2. Human distribution for Phase 1 external pay  
3. Keep Settlement Sync + approved catalog aligned  

## REVENUE

Still 0 until external livemode pay + flags.
