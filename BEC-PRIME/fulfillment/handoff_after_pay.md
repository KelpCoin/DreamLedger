# After pay — fulfilment handoff

Use when Stripe shows a **live** paid session.

## 1. Identify offer

| If metadata / amount | Path |
|----------------------|------|
| ~NZ$50 tile / founding billboard | Billboard: allocate slot → review title/URL → publish or request fix |
| ~NZ$29 diagnostic | Generate report from template `templates/COMMANDER-DECK-DIAGNOSTIC.md` → deliver |
| Discord kit ~NZ$79 | Enable download / send pack |
| Cosmetic | Match email → grant entitlement |

## 2. Settlement

- Run **Commerce Settlement Sync** (tile or diagnostic job).  
- Confirm recognition **or** note plink mismatch.  

## 3. Buyer message (template)

> Thanks for your purchase. We’re fulfilling it now. You’ll get [placement live / report / download] shortly. Reply to this message if anything’s wrong.

## 4. Proof

Work through `python3 scripts/fossil_checklist.py` items.  
Do not update public “revenue” chrome. Update `AGENT_BUS` only with evidence.

## 5. Bridge

```bash
python3 scripts/bridge_ping.py --summary "fulfilled session" --intent money --ball C --mode hybrid
```
