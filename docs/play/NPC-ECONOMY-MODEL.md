# NPC / AI economy model — single-shard application

Applies to **full-parity AI** and any classic NPCs. Humans use the same economy rules.

---

## 1. Design goals

1. AI may participate fully (gather, craft, trade if players can, guild banks).  
2. AI must **not** vacuum the shard (soft + hard limits).  
3. Economy remains fun for humans.  
4. Logs support the experiment (“what they end up doing”).  
5. **No real-money / Stripe** coupling.

---

## 2. Model types (investigation)

| Model | Idea | Fit here |
|-------|------|----------|
| **Closed sink/source** | Nodes spawn resources; sinks (repair, fees, NPC vendors) remove | Primary |
| **Agent-based** | Each actor maximizes utility under constraints | AI brains |
| **Fixed vendor tables** | NPC shops with stock refresh | Optional early |
| **Order book / AH** | Player-driven prices | Later if needed |
| **Unconstrained farm** | Infinite grind | **Reject** |

---

## 3. Resource loop (v1)

```text
Node (regen) → Gather → Inventory → Deposit (guild/personal)
                    ↘ Craft → Gear/consumable → Combat sink (repair/use)
```

- **Sources:** resource nodes with respawn timers and per-node lockouts.  
- **Sinks:** repair, ability consumables, guild upkeep (optional), vendor trash.  
- **Storage:** personal bag caps + guild bank caps.

---

## 4. Anti-vacuum rules (critical with parity AI)

| Rule | Mechanism |
|------|-----------|
| Bag capacity | Hard cap slots/weight |
| Node contention | One gatherer; respawn timer |
| Diminishing returns | Optional fatigue on repeated same node |
| AI economy weight | Utility `w_economy` moderate; goals include non-economy |
| Global soft cap | Daily account/character gather credit (AI + human same) |
| No admin spawn | AI cannot spawn items |

Stealth AI does not get hidden farm bonuses.

---

## 5. GOAP tie-in

Economy goals only when utility says so:

```text
Goal ContributeEconomy if:
  guild_bank_low OR personal_need OR board says GATHER_X
Plan example:
  MoveToNode → GatherNode → MoveToDeposit → Deposit
```

If `InventoryFull`, planner prefers Deposit before Gather.

---

## 6. Guild economy

- Guild bank shared under rank permissions (AI leaders allowed).  
- Board objective `STOCKPILE(resource)` raises gather utility for members.  
- All-AI guilds may stockpile; ops logs track imbalance vs human guilds.

---

## 7. Trade

| Phase | Policy |
|-------|--------|
| v1 | Direct trade if players have it; AI uses simple “fair” valuation table |
| v2 | Listing on AH with price bands to avoid manipulation extremes |

AI should not perfect-arbitrage every tick (rate-limit listings).

---

## 8. Metrics

- Resources/hour by AI vs human  
- Node contention events  
- Guild bank growth  
- % AI time in gather vs combat vs social  

If AI gather ≫ human, lower `w_economy` or tighten daily credits.

---

## 9. One sentence

**Same economy rules for everyone; closed sources/sinks and caps stop full-parity AI from eating the world.**
