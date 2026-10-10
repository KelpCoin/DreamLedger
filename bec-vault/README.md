# BECK Vault

Local, human-readable knowledge layer for Brown Eye Cortex (BECK).

## Purpose

- Survive Supabase / data-plane outages with durable, browsable notes
- Compound prior gauntlet decisions, candidates, and observations
- Give humans a graph-friendly view alongside `ledger.jsonl` and SQLite

## Hard rules

1. **Vault notes are not revenue.** Never count a markdown file, candidate, or decision note as external settlement.
2. **Stripe / webhook / fulfillment remain the commerce authority.** Vault is a mirror and memory layer only.
3. **Offline-first.** No secrets, service-role keys, or live payment credentials in this tree.
4. **Hash when possible.** Prefer linking notes to ledger entry hashes for forensic continuity.

## Layout

```text
bec-vault/
  candidates/      # staged / proposed opportunities (inbox)
  decisions/       # gauntlet + clinical + human-gate outcomes
  observations/    # demand signals, market notes, research
  offers/          # approved or candidate commercial offers (reference)
  ledger/          # human-readable mirrors of ledger events
  templates/       # note frontmatter templates
  daily/           # optional daily briefs
```

## Mapping to runtime

| Runtime | Vault |
|---------|--------|
| `staging/candidates/` | `candidates/` |
| gauntlet / clinical outcomes | `decisions/` |
| demand / research | `observations/` |
| allowlisted products | `offers/` |
| `ledger.jsonl` append | `ledger/` note per event (or daily batch) |

## Workflow (minimal)

1. **Capture** — new signal → note in `observations/` or candidate in `candidates/`
2. **Process** — gauntlet/clinical → note in `decisions/` with outcome + hash
3. **Plan** — human gate card references decision + candidate ids
4. **Closeout** — ledger append + optional mirror under `ledger/`

## Not in scope (this scaffold)

- Cortex MCP / Obsidian plugin install
- Automatic Dataview dashboards
- Claiming vault state as database recovery or verified revenue

## First-dollar track

Commerce recovery (Stripe alignment, webhook → order → fulfillment) is independent.
This vault only makes preparation durable while the data plane is down.
