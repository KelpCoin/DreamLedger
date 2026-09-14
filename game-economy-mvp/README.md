# DreamLedger Economic MVP

Deterministic five-market trading sandbox implementing the core game loop:

**Discover imperfect opportunity → Commit capital → Move value → Settle → Reputation**

## What this MVP proves

- One complete player trade produces the full chain:  
  `DISCOVERED → AUTHORIZED → RESERVED → EXECUTED → IN_TRANSIT → DELIVERED → SOLD → SETTLED → EVIDENCE → REPUTATION`
- NPCs use the **same** transaction engine as the player.
- Capital, inventory, and authority limits are enforced.
- Idempotency is respected.
- Settlement is mathematically conserved (integer arithmetic only).
- Governance (marketplace fee) can be changed and is observable.
- The same seed always produces identical results.
- No secrets, credentials, or real-money state are exported.

## Run

```bash
python3 run_mvp.py
```

Proof artifact is written to `game/proof/economic_mvp_proof.json`.

## Structure

```
game/
  economy/
    types.py      # fixed-point Money, core entities
    engine.py     # EconomyEngine + transaction lifecycle
  simulation/
    seeded_random.py
  proof/
    economic_mvp_proof.json
run_mvp.py
```

## Design constraints respected

- No floating-point currency.
- No LLM agents.
- No DAO UI / blockchain / tokens.
- No real-money bridge.
- No BrownEye secrets.
- Markets use supply/demand pressure + liquidity depth (not pure random prices).
- Capital has diminishing utility via liquidity limits and market impact.
- Decision quality (risk-adjusted spread under uncertainty) is the core loop, not grind.

See also: `docs/ARCHITECTURE_DUAL_WORLD.md` for the dual-world (game ↔ real work) model.
