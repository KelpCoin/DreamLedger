# PhinHaven Stack Adoption

Updated 2026-10-08.

## Decision

PhinHaven stays on its existing browser + Supabase foundation. External repositories are adopted as small primitives, not as a replacement engine.

| Candidate | Decision | Use |
|---|---|---|
| three.ws | ADOPT SELECTIVELY | avatar/wardrobe/cosmetic patterns, x402 asset/payment primitives, MCP/agent integration ideas |
| x402-trinity-gaming | ADAPT LATER | headless game payment rail for a future native/Unity/Unreal client; do not replace the first Stripe cash register |
| Rivalis | ADAPT LATER | multiplayer rooms/actors/reconnect/rate limits if Supabase Realtime becomes the bottleneck |
| srich3/tacto | BORROW PATTERN | Supabase + realtime territory-control mechanics |
| Debux Billboard | BORROW PATTERN | finite in-world billboard inventory, rental lifecycle, editor concepts |
| open-mmorpg | REFERENCE ONLY | long-horizon native MMO engine option; adopting it now would be a rewrite |
| SubspaceHunter-SAO | REJECT AS CORE | SAO-associated assets create unnecessary IP/licensing risk; mechanics can be recreated independently |
| TrinityCore/AzerothCore | REFERENCE ONLY | mature emulator architecture but wrong legal/product substrate |
| onchain-game-economy | LATER | anti-inflation primitives only when PhinHaven has a real economy needing them |
| UnityMultiplayerARPG_UMA | LATER | wardrobe database only if/when PhinHaven moves to Unity |
| Ready Player Me | LATER | cross-engine avatar adapter if a native client requires it |

## Immediate economic lane

1. DreamMeez Stripe checkout and entitlement.
2. Billboard QR attribution.
3. PhinHaven cosmetic possession.
4. Territory/floor systems.
5. Native MMO/networking upgrades only after the browser game proves demand.

## Autonomy rule

Phone LLMs, wife's phone LLMs, LM Studio/llmster, cloud agents and GitHub agents work from GitHub Issues + AGENTS.md + existing CUBE/public.jobs + Agent Bridge. Each bounded job produces code, test evidence and a durable handoff. Biggie receives only genuine authority gates.

## Economic truth

No candidate repository, code merge, checkout, or test is revenue. VERIFIED_EXTERNAL_REVENUE remains NZ$0 until an independent buyer settles and the purchased result is fulfilled with evidence.
