# Income now — use the infrastructure

Architecture is not cash. This is the **shortest path** that uses what already exists.

## Canonical sell surface (live)

| Item | Value |
|------|--------|
| Store | https://dreamledger.org/?src=dist |
| Founding tile | https://buy.stripe.com/dRmbJ2cZi9eW4mk9La9oc02 |
| Price | NZ$50 live |
| Settlement | GitHub Action **Commerce Settlement Sync** |

## Checkpointed operator path (air-gap safe)

```powershell
cd <DreamLedger>
.\ops\money\Run-FirstSaleThread.ps1 boot
.\ops\money\Run-FirstSaleThread.ps1 next
.\ops\money\Run-FirstSaleThread.ps1 next
# human:
.\ops\money\Run-FirstSaleThread.ps1 advance -Stage SECRETS_OPERATOR_CONFIRM -Note "STRIPE_SECRET_KEY set in Actions"
.\ops\money\Run-FirstSaleThread.ps1 advance -Stage WEBHOOK_OPERATOR_CONFIRM -Note "webhook endpoint live"
.\ops\money\Run-FirstSaleThread.ps1 advance -Stage DEMAND_PULSE_OPERATOR -Note "posted link on <channel>"
.\ops\money\Run-FirstSaleThread.ps1 advance -Stage AWAITING_EXTERNAL_PAY -Note "waiting"
```

After a **stranger** pays:

1. Run Commerce Settlement Sync — confirm `cs_` in artifact  
2. Fulfil tile per registry  
3. Fossil  
4. Only then:

```powershell
.\ops\money\Run-FirstSaleThread.ps1 advance -Stage SETTLED_RECOGNIZED -Note "artifact run_id=..."
.\ops\money\Run-FirstSaleThread.ps1 advance -Stage FULFILLED_PROOF -Note "placement proof url=..."
.\ops\money\Run-FirstSaleThread.ps1 advance -Stage FOSSIL_SEALED -Note "fossil hash=..."
```

## Persistence strategy

See `BEC-PRIME/persistence/LANGGRAPH-CHECKPOINT-STRATEGY.md`.  
SQLite checkpoints = LangGraph-style threads without requiring LangGraph installed today.

## Do not

- Build more silos before one external settle  
- Mark FOSSIL_SEALED without proof note  
- Treat checkpoint progress as verified revenue  
