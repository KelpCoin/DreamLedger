# Stealth AI cohort — operator policy

**Status:** Operator-directed design for initial Phin Haven / single-shard experiment.

## Policy

- AI-controlled characters are **not announced** to players in the initial phase.  
- Client treats them like any other character (no “AI” badge).  
- Rationale given by operator: not that different from sophisticated NPCs from the outside.  
- Server **always** knows (`controller=ai_brain`) for scaling, budgets, and experiment logs.  

## Limits

- Does not authorize deception in **commerce** (settle lobe). Agent passports / payments stay honest.  
- Does not authorize real-money RMT via AI.  
- Ops may disclose later without redesigning core AI.  

## Density

Start **very low** AI count; see `AI-COHORT-SCALING.md`.
