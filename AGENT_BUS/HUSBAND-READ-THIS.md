# Husband — read this (evidence + money)

This file exists so you do not have to trust chat.

## Bank balance

**Verified external revenue is NZ$0** until a real customer pays live on Stripe and you fulfil.  
No agent, bridge, or document can honestly claim otherwise.

## Where the work lives (open these)

1. **This week money:** [`ops/money/THIS-WEEK-COMMAND.md`](../ops/money/THIS-WEEK-COMMAND.md)  
2. **Posts to send:** [`ops/money/DEMAND-KIT.md`](../ops/money/DEMAND-KIT.md)  
3. **Agent Bridge:** [`AGENT_BUS/BRIDGE/PROTOCOL.md`](BRIDGE/PROTOCOL.md)  
4. **Economic loops:** [`AGENT_BUS/ECONOMIC-LOOPS/registry.json`](ECONOMIC-LOOPS/registry.json)  
5. **Priorities:** [`AGENT_BUS/PING_PONG_BALLS.json`](PING_PONG_BALLS.json)  

## Dual mode

- **Local / air-gap:** `python3 scripts/bridge_ping.py …` then push when online  
- **Cloud:** GitHub Actions (sentinels, settlement) + live site  

## What actually puts money in the account

1. Align Stripe links (`ops/money/SETTLEMENT-LINK-ALIGNMENT.md`)  
2. Post DEMAND-KIT on a channel you control  
3. Someone pays  
4. You fulfil (`ops/money/POST-SALE-PROTOCOL.md`)  

Bridge + loops **organize** that. They do not replace step 2–3.
