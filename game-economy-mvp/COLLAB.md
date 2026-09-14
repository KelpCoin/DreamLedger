# Collaboration on economic-game-mvp

This branch is the shared surface for the deterministic economic MVP and the dual-world architecture.

## Who can work here

- Primary operator (this Grok instance + human)
- Secondary operator (wife’s Grok instance via the same GitHub connection)

Both can read, write, open PRs, and review against `economic-game-mvp`.

## Current state

- `docs/ARCHITECTURE_DUAL_WORLD.md` – the binding design rule: game events never pretend to be real economic events.
- `game-economy-mvp/` – pure deterministic engine (5 markets, 10 commodities, 1 avatar, 20 NPCs).
- Proof artifact demonstrates a complete DISCOVERY → … → SETTLEMENT → EVIDENCE chain under a fixed seed.

## Hard rules both operators must respect

1. No automatic path from game discovery to real-world execution.
2. REAL_CANDIDATE → HUMAN_REVIEW → APPROVED_REAL_ACTION is the only legal progression for real work.
3. Stripe / real payment surfaces are only reachable after explicit human approval.
4. BrownEye receives only sanitized evidence after a REAL_VERIFIED outcome.
5. In-game currency is never sold for real money and never cashes out.

## Suggested next shared tasks

- Work Packet schema (JSON)
- Classification state machine implementation
- “Investigate in the real world” action that only creates a REAL_CANDIDATE packet
- Human approval UI / API gate

Open issues or PRs against this branch. Keep the economic engine pure.
