# Guild AI behavior — full player parity (operator build target)

Companion: `SINGLE-SHARD-AI-PRESENCE.md`, `AI-COHORT-SCALING.md`, `STEALTH-AI-POLICY.md`.

**Play lobe only.** No Stripe, no Performance Wall, no verified revenue.

---

## Operator decisions (binding for this design)

1. **Parity:** AI-controlled characters may do **anything a normal player can do** under the same shard rules (move, fight, gather, trade if players can, form/join/leave **their own guilds**, group, progress PVE).  
2. **Guilds:** AI may found guilds, invite other AI (and humans if humans accept), set objectives, hold ranks—subject to the same server validation as humans.  
3. **Disclosure:** **Initially do not tell players** which characters are AI. Treat them as ordinary participants from the client’s point of view (operator policy). Internal server flag `controller=ai_brain` remains for ops/metrics only.  
4. **Density:** Start with a **very low** AI count; raise only when sim and GPU budget allow.  
5. **Compute:** Brains may use **operator GPU** (local inference) when helpful; hot path stays utility/GOAP; LLM optional and async.  
6. **Ghosts:** Logout humans still leave **~10% strength** shells; those are not full AI brains unless later promoted by policy.

---

## Full action parity

AI action space = **player action space**. No artificial “NPC-only” subset.

Includes (non-exhaustive):

- Locomotion, combat, abilities, inventory  
- Gather / craft / deposit if players can  
- Guild create / invite / kick / rank / MOTD / shared objectives  
- Party/group if the game has it  
- Chat channels available to players (rate-limited like players)  
- Quest / node / boss participation  

Server must enforce the **same** anti-cheat, cooldowns, and economy rules. Parity means equal rights under rules—not free admin powers.

---

## Guilds owned by AI

```text
AI character
  → guild.create(name)     // if human can
  → guild.invite(other)
  → guild.set_objective()
  → same rank permissions as a human officer/leader
```

Possible emergent patterns to log:

- All-AI guilds  
- Mixed human–AI guilds (if humans invite or accept)  
- AI competing for the same nodes as humans  

Experiment still asks: **what do they end up doing?**

---

## Brain architecture

```text
Tick (cheap): utility / GOAP over full player action set
Async (optional GPU): LLM proposes mid-term goals, chat lines, guild strategy
Server: validates every action like a client input
```

| Component | Where |
|-----------|--------|
| Perception + legal moves | Server |
| Utility scores | Server or worker |
| LLM goals/chat | Operator GPU / local model (throttled) |
| Persistence | Same character DB as humans |

Do **not** put frontier API calls on every combat frame.

---

## Stealth vs internal truth

| Surface | AI visible? |
|---------|-------------|
| Client nameplate / UI | **No special “AI” badge** (operator policy, initial phase) |
| Server entity record | `controller: ai_brain` |
| Ops dashboards / logs | Yes |
| Commerce / Stripe | N/A — play only |

If policy later changes to disclose, flip client label without rewriting brains.

---

## Density (initial)

See `AI-COHORT-SCALING.md` — **low band** default, e.g. hard cap 2–5 AI until stable, then formula.

---

## Failure modes

| Risk | Mitigation |
|------|------------|
| AI out-competes economy | Same caps as humans + global soft caps |
| AI chat feels robotic | Templates + rare LLM; rate limits |
| GPU overload | Queue LLM; fall back to utility-only |
| Players accuse “bots” | Same ToS enforcement as any client; improve behavior fidelity |
| Mixed-guild drama | Same moderation tools as human guilds |

---

## Build order (game must be built)

1. Shard + character + movement/combat authoritative  
2. Logout ghost 10%  
3. AI controller injecting **player-equivalent** inputs  
4. Guild system shared by human + AI  
5. Low-N AI spawner  
6. Optional GPU LLM worker  
7. Behavior logs (ops-only)  

---

## One sentence

**Guild AI is a low-count, full-parity player under the same rules—including founding guilds—stealth on the client, flagged only on the server, optionally GPU-assisted, play-only.**
