# Guild AI behavior — single-shard PVE investigation

Companion to `SINGLE-SHARD-AI-PRESENCE.md` and `AI-COHORT-SCALING.md`.

**Play lobe only.** Guild AI never touches Stripe, wall mint, or verified revenue.

---

## 1. What “guild AI” means here

Not a chatbot with a guild tag. A **server-authoritative entity** that:

- Holds a `guild_id` (or null = unaffiliated AI)
- Picks actions from a **bounded action set** under shard rules
- Is labeled `play_agent` / AI in UI
- Scales in count with human population
- Is distinct from **ghost shells** (logout humans at ~10% strength, little/no brain)

Industry lesson: pure LLM “live as a person” NPCs drift without **external goals and state**. Utility AI / GOAP for ticks; optional LLM for sparse dialogue or high-level objective *proposals*, not every combat frame.

---

## 2. Layers of behavior

```text
┌─────────────────────────────────────────┐
│  Guild objective layer (shared board)   │  e.g. “clear node N”, “defend camp”
├─────────────────────────────────────────┤
│  Role layer (tank / support / gather)   │  assigned or self-selected
├─────────────────────────────────────────┤
│  Utility / GOAP action selection        │  every AI tick
├─────────────────────────────────────────┤
│  Locomotion + combat primitives         │  server validated
└─────────────────────────────────────────┘
     optional: LLM proposes objective text (rare, async)
```

| Layer | Frequency | Model |
|-------|-----------|--------|
| Tick actions | 5–20 Hz budgeted | Utility scores / GOAP |
| Role re-eval | minutes | Rules |
| Guild objective | on board change / timer | Designer or simple planner |
| Chat / flavor | sparse | Template or throttled LLM |

---

## 3. Guild roles (PVE)

| Role | Primary utilities | Avoid |
|------|-------------------|--------|
| **Tank** | Intercept threat, hold aggro, stay near objective | Deep roam alone |
| **Support** | Heal/buff lowest HP ally, cleanse | Frontline greed |
| **DPS** | Focus marked target, interrupt if available | Pad damage off-target |
| **Gatherer** | Nodes near guild area, deposit storage | PvE pulls without tank |
| **Scout** | Edge of area, ping elites | Suicide aggro |
| **Idle citizen** | Emote, path scenic, listen to board | Resource vacuum |

Ghost shells do **not** take roles; they are furniture with HP.

---

## 4. Utility scoring (v1 brain)

For each candidate action `a`:

```text
score(a) =
  w_objective * alignment(a, guild_objective)
+ w_role      * role_fit(a)
+ w_survival  * self_hp_pressure(a)
+ w_social    * ally_hp_pressure(a)
+ w_economy   * resource_need(a)      // capped
- w_risk      * danger(a)
- w_spam      * recent_repeat(a)
```

Pick max score among legal actions. Cap economy weight so AI doesn’t become infinite gather bots (exploit class).

### Example action set

- `MOVE_TO(point|ally|node)`  
- `ATTACK(target)`  
- `USE_ABILITY(id, target?)`  
- `GATHER(node)`  
- `DEPOSIT(storage)`  
- `FOLLOW(ally)`  
- `HOLD_POSITION`  
- `PING(objective)`  
- `EMOTE`  

Illegal if out of range, on cooldown, or soft-banned by area policy.

---

## 5. Guild shared board

Single-shard advantage: one **guild blackboard** per guild:

```json
{
  "guild_id": "g_…",
  "objective": { "type": "CLEAR_NODE", "target_id": "node_12", "priority": 1 },
  "markers": [{ "type": "ATTACK_THIS", "entity_id": "…" }],
  "rally_point": { "x": 0, "y": 0 },
  "updated_at": "ISO-8601"
}
```

- Humans (leaders) or scripts set objectives.  
- AI reads board; does not invent real-money goals.  
- When objective completes, AI falls back to role default (patrol/gather light).

---

## 6. Social rules (guild)

| Behavior | Policy |
|----------|--------|
| Help downed human | High priority if in same guild + LOS |
| Trade | Disabled for AI v1 (or scripted only) |
| Kick/invite | AI cannot; humans only |
| Chat | Templates: “on my way”, “node clear”; no fake human identity |
| Follow stranger | No |
| Grief / PK | No (PVE shard) |

Research note: players like adaptive companions (role flex, memory) but MMO social fabric weakens if AI replaces human need—keep AI as **presence + PVE assist**, not substitute guild.

---

## 7. Ghost vs guild AI (do not merge)

| | Ghost offline | Guild AI |
|--|---------------|----------|
| Origin | Human logout | Spawner |
| Strength | ~10% | Full AI profile (may be weaker than geared humans) |
| Brain | None / idle | Utility GOAP |
| Guild | Keeps human’s guild id | Assigned or null |
| Despawn | On login | Population formula |

---

## 8. Experiment: “what they end up doing”

Append-only log:

```text
t, entity_id, guild_id, role, action, objective_type, area_id
```

Aggregate daily:

- % time combat / gather / move / idle / support  
- Objective completion rate  
- Deaths per hour  
- Distance from rally  

Hypothesis to test: without strong `w_objective`, AI collapses to gather/idle (seen in agent-only sandbox MMOs). **Board + role weights** are the lever.

---

## 9. Failure modes

| Failure | Mitigation |
|---------|------------|
| AI farms economy dry | Soft caps, node lockouts, low `w_economy` |
| AI packs denser than humans | Cap + spawn distance rules |
| LLM on hot path | Never; async only |
| Players think AI is human | Nameplate + passport label |
| Tick cost explodes | LOD: far AI lower rate |
| AI blocks content | Cannot hold unique quest locks |

---

## 10. Implementation order

1. Action set + utility brain (no guild)  
2. Roles  
3. Guild blackboard  
4. Spawner scaling  
5. Behavior logs  
6. Optional sparse LLM flavor  

---

## 11. One sentence

**Guild AI is a labeled, board-driven utility actor in a single-shard PVE sim—presence and experiment first, never a commercial agent and never a fake human.**
