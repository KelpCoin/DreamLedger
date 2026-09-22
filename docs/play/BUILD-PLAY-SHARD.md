# Build the play shard (checklist)

Operator: game needs to be built. This is the ordered checklist for single-shard guild PVE + stealth AI.

## Must exist

- [ ] Authoritative server process (one shard)  
- [ ] Character login / logout  
- [ ] Persist position + area  
- [ ] Ghost shell on logout (10% strength)  
- [ ] Movement + PVE combat validation  
- [ ] Inventory / basic progression  
- [ ] Guild create/invite/ranks (human + AI same API)  
- [ ] AI controller submits same command messages as clients  
- [ ] Spawner: 0–N AI with hard cap (start 3)  
- [ ] Ops-only `controller` field + behavior logs  
- [ ] Optional: GPU worker for goal/chat proposals  

## Must not

- [ ] AI calling Stripe / wall / revenue APIs  
- [ ] Client “AI” badge in phase 0  
- [ ] Unlimited AI count  

## Existing anchors in monorepo

- Phin Haven / Shallows browser and Godot scaffolds under `phinhaven/` (where present)  
- Design docs under `docs/play/`  

Money path remains Ball C on settle lobe; this checklist is play lobe.
