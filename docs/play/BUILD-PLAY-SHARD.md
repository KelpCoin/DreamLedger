# Build the play shard (checklist)

## Must exist

- [ ] Authoritative single-shard server  
- [ ] Character login/logout + ghost 10%  
- [ ] Movement + PVE combat  
- [ ] **Same command API for human client and AI**  
- [ ] Guilds (create/invite/ranks) for all controllers  
- [ ] Utility goal layer  
- [ ] GOAP planner + seed actions (`goap-action-catalog.json`)  
- [ ] BT (or FSM) action executors  
- [ ] Economy: nodes, bags, sinks, caps (`NPC-ECONOMY-MODEL.md`)  
- [ ] Low-N AI spawner (stealth)  
- [ ] Ops logs (controller flag hidden from client)  
- [ ] Optional GPU LLM worker  

## Docs

- `GOAP-AND-BEHAVIOR-TREES.md`  
- `NPC-ECONOMY-MODEL.md`  
- `GUILD-AI-BEHAVIOR.md`  
- `STEALTH-AI-POLICY.md`  

## Not this lobe

Stripe / wall / revenue.
