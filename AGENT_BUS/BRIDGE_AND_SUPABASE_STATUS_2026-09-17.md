# Control bridge + Supabase status — 2026-09-17

## What exists in the repo (visible)

| Component | Path | Role |
|-----------|------|------|
| AgentBridge runtime | `BEC-PRIME/runtime/AgentBridge*.js` | Job fence, economic highway, LLM monetization gates |
| Multi-LLM contract | `CONTROL-PLANE/LM-STUDIO-MULTI-LLM.md` | PROPOSER→CRITIC→SYNTHESIZER→GAUNTLET→PROOF |
| Local multi-LLM config | `BEC-PRIME/integrations/kelplantis/multi-llm.config.json` | `localhost:1234/v1` roles architect/builder/critic |
| Cloud continuity | same MD + GH secrets `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL` | PC-off refinement |
| Orchestrator | `ops/local/money_orchestrator.py`, workflows `orchestrator-tick.yml` | Tick loop |
| Supabase migrations | `supabase/migrations/*` | Floor progression, economic bridge, DreamMeez |
| Project ref (from proofs) | `wbwgroygjeyukkspnqiy` | Live DB named in 2026-09-08 proof |

## What this Grok session has

| Connector | Status |
|-----------|--------|
| GitHub | **Connected** — writes land on main |
| Supabase | **Not in available connectors** — cannot INSERT/UPDATE live DB from here |
| Stripe | Available to *connect* in UI — not yet connected this session |
| LM Studio | Local only — requires PC + `localhost:1234` |

**Available to connect (user):** Gmail, Stripe, Notion, Vercel, Linear, … — **not Supabase** as a first-class Grok connector today.

## What needs fixing for “orchestrate other LLMs”

1. **Local:** PC on → LM Studio server → AgentBridge worker reads multi-llm.config.json.  
2. **Cloud:** Set repo secrets `LLM_API_URL` / `LLM_API_KEY` / `LLM_MODEL` so Actions can run critic/synth when PC off.  
3. **Supabase second line:** Agent with service role or SQL editor applies prospecting rows / Floor 1 claims — use handoff JSON in `AGENT_BUS/`.  
4. **Do not** expect this chat session to call `localhost:1234` or Supabase REST without those connections.

## Supabase write handoff (for agent with DB access)

Insert candidate shape (pending human review only):

```json
{
  "source": "grok_session",
  "kind": "unit_economics_refresh",
  "sku_priority": ["billboard-tile", "commander-diagnostic", "discord-kit"],
  "doc": "ops/economics/UNIT_ECONOMICS_AND_COMPETITIVE_PRICING_2026-09-17.md",
  "approval_status": "pending_human_review"
}
```

Never set `approved` without human / fail-closed guards.

## Live site

`https://dreamledger.org/` returns `data-surface="enterprise-v1"` — front-door promote **succeeded**.
