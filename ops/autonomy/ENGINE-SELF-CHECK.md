# Engine self-check (operator or CI)

Run in order. Fail closed.

```bash
# 1 Bridge
python3 scripts/bridge_process_inbox.py --dry-run
python3 scripts/loop_status.py

# 2 Optional live loops
python3 scripts/loop_status.py --live

# 3 Cloud (GitHub UI)
# - Commerce Settlement Sync (expect 0 pre-sale)
# - Cloud Demand + Intent Sentinels

# 4 Money readiness
# - ops/money/SETTLEMENT-LINK-ALIGNMENT.md checklist
# - ops/money/DEMAND-KIT.md posts scheduled
```

Pass criteria for **L1:** Settlement Sync green, revenue 0, buy routers reach Stripe.  
Pass criteria for **L3:** external pay + fulfil + fossil — not this script alone.
