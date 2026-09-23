# Bridge refinement for money (not architecture theatre)

Repo: coordination via DreamLedger AGENT_BUS + llm-supabase-github-bridge.

## Status

IMPLEMENTED_PARTIAL. Revenue 0. Blocker: external buyer.

## Refinements that matter

1. **Single catalog authority** — DreamLedger `approved.json` wins over any stale link in bridge status JSON.  
2. **Handoff after pay** — any agent that sees a live `cs_` must leave AGENT_BUS handoff with session id hash, not a revenue claim.  
3. **Fulfil branch** — tile → billboard path; digital → Performance Wall mint.  
4. **No parallel ledger** in bridge.  
5. **Balls v18+** immediate_next = post approved tile link.  

## Do not

- Build second orchestrator  
- Claim bidirectional reconciliation live if status says not  
- Spend cycles on play AI before first fossil  
