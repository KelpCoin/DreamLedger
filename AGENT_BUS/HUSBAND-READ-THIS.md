# Husband — read this

## Bank

**NZ$0 verified external revenue** until a real customer pays live and you fulfil. Infrastructure ≠ income.

## Open these on GitHub

1. [`ops/autonomy/REVENUE-ENGINE-SPINE.md`](../ops/autonomy/REVENUE-ENGINE-SPINE.md) — full engine map (L0–L6)  
2. [`ops/money/THIS-WEEK-COMMAND.md`](../ops/money/THIS-WEEK-COMMAND.md) — what to do this week  
3. [`ops/money/DEMAND-KIT.md`](../ops/money/DEMAND-KIT.md) — posts  
4. [`AGENT_BUS/BRIDGE/PROTOCOL.md`](BRIDGE/PROTOCOL.md) — Agent Bridge  
5. [`ops/autonomy/ENGINE-SELF-CHECK.md`](../ops/autonomy/ENGINE-SELF-CHECK.md) — verify rails  

## Local commands

```bash
git pull
python3 scripts/loop_status.py --live
python3 scripts/bridge_process_inbox.py --dry-run
python3 scripts/bridge_ping.py --summary "operator online" --mode hybrid --ball C
```

## Money path (unchanged)

Align plinks → post DEMAND-KIT → someone pays → fulfil → fossil.
