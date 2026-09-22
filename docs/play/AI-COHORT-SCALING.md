# AI cohort scaling (low-first)

## Phase 0 — initial (now)

```text
ai_hard_cap = 2..5   // operator choice; default 3
ai_target = min(ai_hard_cap, max(0, floor(humans * 0.1)))
```

At low concurrent humans, keep AI **scarce**. Prefer empty-feeling world over obvious bot flood.

## Phase 1 — after stable sim

```text
ai_target = clamp(floor(humans * k) + base, min_ai, max_ai)
// example: k=0.25, base=1, max_ai=20
```

Raise `k` and `max_ai` only with tick + GPU headroom.

## Ghosts vs AI

| Type | Count driver |
|------|----------------|
| Ghost shells | Human logouts (1:1 characters) |
| AI cohort | Formula above |

## GPU budget

- Utility AI: CPU server  
- LLM strategy/chat: operator GPU queue, max N concurrent inferences  
- If GPU busy: AI still acts via utility only  
