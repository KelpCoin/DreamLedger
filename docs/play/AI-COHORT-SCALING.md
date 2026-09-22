# AI cohort scaling formula (experiment)

## Default proposal

```text
humans = count(controller == human_session AND online)
ai_target = clamp(floor(humans * 0.5) + 2, 2, 40)
```

- At 0 humans: keep a small ambient AI set (2) so the shard is not empty for observers—or 0 if “empty world” is preferred.  
- At 10 humans: ~7 AI.  
- Cap 40 to protect single-shard tick budget.

Tune `k`, floor, cap after measuring frame time.

## Ghosts vs AI

| Type | Scales with |
|------|-------------|
| Ghost shells | Logouts (one per character) |
| AI cohort | Online human count (formula) |

Ghosts are **not** AI brains; they are attenuated player shells.

## Logging

Append-only behavior events: `entity_id`, `t`, `action`, `area_id` — for the “what they end up doing” experiment.
