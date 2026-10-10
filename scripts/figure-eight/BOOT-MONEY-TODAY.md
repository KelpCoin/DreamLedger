# Boot sequence — money today (Figure Eight + wall)

**Truth:** `VERIFIED_EXTERNAL_REVENUE = NZ$0` until an independent external settlement is fulfilled and evidenced.

This is the order when the PC comes on. Do not reverse it.

## 0. Goal for today (one loop)

Pick **one** live Stripe offer and close the loop:

| Offer | Price | Checkout |
|-------|-------|----------|
| Founding Billboard | NZ$50 | https://buy.stripe.com/00w4gz6HzeWhcizeZedwc2w |
| Commander Deck Diagnostic | NZ$29 | https://buy.stripe.com/eVqeVdc1T01n1DV3gwdwc30 |
| Edward Kenway EDH | NZ$230 | https://buy.stripe.com/14A3cvea1dSd1DV5oEdwc1J |

**Success today** = real buyer (can be you testing once) → Stripe settled → fulfilment recorded → not claimed as “engine revenue” until independent of self-test policy if you require that.

GPU toll / 10k roads stay **checkout_enabled: false** until durable quota exists.

## 1. Repo + Figure Eight preflight (no Apply yet)

```powershell
cd <path-to-DreamLedger>
git pull origin main

# Verify-only — creates proof, does not push migrations, does not invent revenue
.\scripts\figure-eight\FigureEight-Bootstrap.ps1 -VerifyOnly

# Optional diagnostic (needs network / supabase if linked)
.\scripts\figure-eight\FigureEight-Diagnostic.ps1
.\scripts\figure-eight\FigureEight-Verify.ps1
```

Read `proof\figure-eight\bootstrap-proof.json`. FAIL must be zero before `-Apply`.

## 2. Elohim observe (read-only)

```powershell
python .\scripts\elohim_observe.py
```

Expect: toll manifest, products, privacy/terms/security/contact, shop, mtg all `ok: true`.

**This does not unlock local mutation.**

## 3. Policy gauntlet (CI same script)

```powershell
python .\scripts\gauntlet_evaluator.py
```

Must print `"passed": true`.

## 4. Arm the commercial wall (human)

1. Open https://dreamledger.org/shop.html  
2. Confirm the chosen offer shows a working Buy / Stripe link  
3. Complete **one** real payment (external card preferred)  
4. Fulfil: deliver digital artifact or ship physical deck; keep receipt + delivery evidence  
5. Only then treat revenue as observed (still document if self-purchase)

## 5. Figure Eight Apply (only if VerifyOnly was clean and DB is reachable)

```powershell
# Requires supabase CLI logged in and project reachable
.\scripts\figure-eight\FigureEight-Bootstrap.ps1 -Apply
```

If `ECONNREFUSED` / PostgREST 503: **stop**. Fix data plane before workers.

## 6. What not to do today

- Do not enable paid Toll Road packs without durable quota  
- Do not expose LM Studio raw port to the internet  
- Do not run cloud scorecards that auto-mutate local state  
- Do not mark REV_ATOM from simulated or internal-only tests  

## Figure Eight invariant (state-machine)

`SIGNAL → … → SETTLED → FULFILLMENT_COMPLETE → INDEPENDENTLY_VERIFIED → REV_ATOM`  
Human approval before authorized external action. No fake REV_ATOM.
