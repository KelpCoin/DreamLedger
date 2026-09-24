# HANDOFF — Zero balance: settlement aligned to live buys

## OBSERVED

Account still NZ$0. Settlement Sync was hard-coded to plink `9B66oH2rj3dz82jcR6dwc2x` while live tile buy went to `00w4gz6HzeWhcizeZedwc2w` — **meter could miss real pays**.

## CHANGED

- Dual Settlement Sync jobs for **live** tile + diagnostic plinks  
- `ZERO-BALANCE-PLAYBOOK.md` + `COPY-PASTE-NOW.txt`  
- commerce README updated  

## PERSISTED

main.

## VERIFIED

Live redirects probed 2026-09-25. Revenue still 0.

## UNVERIFIED

Actions secret present; workflow green; any pay.

## BLOCKED

Distribution (human posts).

## NEXT

Operator posts COPY-PASTE-NOW. Run Settlement Sync once.
