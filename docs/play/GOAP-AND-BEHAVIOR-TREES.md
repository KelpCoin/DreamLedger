# GOAP and behavior trees — applied to the single-shard game

Companions: `GUILD-AI-BEHAVIOR.md`, `NPC-ECONOMY-MODEL.md`, `STEALTH-AI-POLICY.md`.

---

## 1. What each technique is

### Behavior trees (BT)

Hierarchical **control flow**: selectors, sequences, parallels, conditions, leaf tasks.

- Ticked often; very debuggable; great for **tactical sequences** (“reload → aim → fire”).  
- Author spells out *how* branches work.  
- Weak at long multi-step *novel* chains unless you hand-author them.

### GOAP (Goal-Oriented Action Planning)

Agent has a **goal** (desired world state) and a library of **actions** with preconditions / effects. A planner (often A*) finds an **action sequence** to reach the goal.

- Strong when many combinable actions (craft → haul → store).  
- Emergent plans; harder to implement/debug; cost rises with action count.  
- Classic reference: F.E.A.R. combat AI (Orkin).

### Utility AI

Score candidate goals or actions with considerations; pick the best.

- Excellent for **which goal now** (hunger vs combat vs guild objective).  
- Often sits *above* GOAP or BT.

### Hybrid (industry default for complex agents)

```text
Utility  →  choose GOAL
GOAP     →  plan ACTION SEQUENCE toward goal
BT       →  execute current action / micro tactics
LLM/GPU  →  optional rare goal suggestion / chat (async)
```

---

## 2. Application to this game

**Constraints:** single shard, guild PVE, AI **full player parity**, stealth client, low AI count, optional GPU.

| Layer | Tech | Responsibility |
|-------|------|----------------|
| Goal selection | **Utility** | Combat threat, guild board, needs, economy pressure |
| Multi-step plans | **GOAP** | Gather→deposit, travel→objective, gear up→fight |
| Atomic execution | **BT** (or short FSMs) | Attack cycle, interact node, open UI-equivalent commands |
| Strategy/chat | GPU LLM async | Optional; never required for correctness |

Ghost shells (logout 10%): **no planner** — idle/hold only.

---

## 3. World state atoms (GOAP)

Boolean / small enums the planner can reason over, e.g.:

```text
InCombat, HasThreat, AllyDown, AtObjective, HasLootSpace,
NodeAvailable, InventoryFull, GuildHasObjective, LowHP,
HasTool, AtDeposit, InGuildHall
```

Keep the atom set **small** at first (≤20) to avoid plan explosion.

---

## 4. Example actions (precondition → effect)

| Action | Preconditions | Effects | Cost hint |
|--------|---------------|---------|-----------|
| MoveToObjective | GuildHasObjective, not AtObjective | AtObjective | distance |
| AttackThreat | InCombat or HasThreat | ThreatReduced | 1 |
| GatherNode | NodeAvailable, not InventoryFull | ResourceGained | 2 |
| Deposit | InventoryHasGoods, AtDeposit | InventoryEmptied | 1 |
| CreateGuild | not InGuild, CanCreateGuild | InGuild, IsLeader | 5 |
| InviteToGuild | IsOfficerOrLeader, TargetValid | MemberAdded | 2 |
| FollowAlly | AllyVisible | NearAlly | 1 |
| Flee | LowHP | NotInCombat (attempt) | 0.5 |

Costs bias short safe plans; abstract “do everything” actions should cost more (Orkin-style).

---

## 5. Example goals (utility-ranked)

| Goal | High when |
|------|-----------|
| Survive | LowHP, InCombat |
| SupportGuildObjective | GuildHasObjective active |
| ContributeEconomy | Guild needs resources / personal soft needs |
| SocialGuild | No objective, in guild hall area |
| OpportunisticPVE | Elite nearby, HP high |

Utility picks **one goal**; GOAP plans; BT runs the first action until success/fail/replan.

---

## 6. Behavior tree under an action

Example leaf for `AttackThreat`:

```text
Sequence
  Selector: AcquireTarget
  Sequence: MoveInRange → Face → UseAbility → WaitGCD
  Condition: TargetAlive? else Success/Fail
```

Replan GOAP if world state breaks preconditions (target dead, objective cancelled).

---

## 7. Tick budget (low AI count helps)

| Rate | Work |
|------|------|
| Every physics tick | BT current action only |
| 2–5 Hz | Utility goal check |
| On event / 1–2 Hz | GOAP replan if dirty |
| Async | LLM suggestions |

With N≤5 AI, full GOAP is affordable; still design for N=20 later.

---

## 8. Why not BT-only or GOAP-only?

- **BT-only:** painful to encode all guild+economy chains; rewiring for every new craft step.  
- **GOAP-only:** micro combat feels sluggish without a tight execution layer.  
- **Hybrid:** matches full-parity players who both *plan errands* and *execute combos*.

---

## 9. Implementation order

1. Command layer (same as human client messages)  
2. BT for combat + interact  
3. Utility goal picker  
4. GOAP planner with ≤12 actions  
5. Expand actions (guild, economy)  
6. Optional GPU goal text  

---

## 10. One sentence

**Utility chooses the goal, GOAP builds the plan, behavior trees execute the next step—same input path as players, stealth AI, play-only.**
