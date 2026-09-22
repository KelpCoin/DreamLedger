# Single-shard PVE presence + AI cohort (Phin Haven / Shallows direction)

**Design experiment for a guild-based, single-server PVE MMO-like loop.**  
Play lobe only—**not** business revenue.

---

## Goals

1. **Logout presence:** when a human logs out, their **sprite remains** in the last area.  
2. **Attenuated power:** offline body runs at **~10% strength** (damage, HP contribution, gather rate—tunable).  
3. **Maintained presence:** still occupies space, visible to others, can be interacted with under strict rules (e.g. no full PvP on offline shells unless designed).  
4. **AI cohort scaled to population:** number of **fully AI-controlled** characters grows with concurrent (or DAU) humans—an experiment in what they do under the same shard rules.  
5. **Honest labeling:** AI entities carry `play_agent` passport / flag; never sold as “real players.”

---

## Single shard constraints

| Constraint | Implication |
|------------|-------------|
| One server / one world simulation | Simpler identity; harder horizontal scale |
| Guild-based PVE | AI can join guilds under NPC/AI policies; no fake human social claims |
| Authoritative server | Client is view; combat/loot server-side |

---

## Entity model

```text
PlayerCharacter
  state: ONLINE | GHOST_OFFLINE | AI_DRIVEN
  strength_multiplier: 1.0 | 0.1 | (AI profile)
  controller: human_session | offline_shell | ai_brain
  passport_class: human_buyer/play | play_agent
```

### Ghost offline (logout shell)

- Position frozen or slow wander in **same area** (policy choice: frozen safer for v1).  
- **10% strength:** outgoing damage ×0.1, maybe incoming still 1.0 or ×1.0 with lower HP—document choice in balance sheet.  
- **Cannot** initiate high-impact social contracts (trade, guild kick) without login.  
- **Can** block tiles, show cosmetics, count toward “presence” metrics.  
- On login: merge session; ghost replaced by full control.

### AI cohort

```text
ai_count_target = f(human_online_count)
  e.g. clamp(round(k * humans), min_ai, max_ai)
```

- Spawn/despawn AI to track band; avoid pop-in abuse.  
- Brains: simple utility AI first (patrol, gather, follow guild objective); later LLM optional **off hot path**.  
- Goals logged for the experiment (“what they end up doing”).  
- **No** AI agent may trigger Stripe or commercial exhaust.

---

## Experiment metrics (play science, not revenue)

| Metric | Question |
|--------|----------|
| Ghost density | Do areas feel inhabited after logout? |
| AI behavior histogram | Time in combat / gather / idle / guild objective |
| Human report | “Felt alive?” surveys |
| Exploit rate | Camping ghosts, AI farm abuse |
| Server cost | AI tick budget vs human count |

---

## Safety

1. Label AI in UI (nameplate / passport).  
2. Cap AI economic actions inside game (no real-money).  
3. Ghosts not AFK-farm infinite resources without drain.  
4. Guild AI follow server quests only.  
5. Rate-limit LLM brains if used.

---

## Implementation phases

| Phase | Deliverable |
|-------|-------------|
| P0 | Data model: ONLINE / GHOST_OFFLINE; 0.1 multiplier |
| P1 | Persist ghost transform on logout; clear on login |
| P2 | AI spawner scaled to human count; nameplates |
| P3 | Behavior logs + operator dashboard |
| P4 | Optional passport `play_agent` issued per AI |

Wire to existing Phin Haven / Shallows paths without blocking Ball C money work.

Schema sketch: `ai-presence.schema.json`.
