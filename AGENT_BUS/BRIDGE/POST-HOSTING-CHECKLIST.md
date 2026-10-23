# Post-hosting checklist — Agent Bridge

Use this only after `https://dreamledger.org/healthz` (or Railway URL) returns success.

## A. Verify engine

```bash
curl -s https://dreamledger.org/healthz
curl -s https://dreamledger.org/version
curl -s -o /dev/null -w "%{http_code}" -X POST https://dreamledger.org/api/toll/v1/bridge-events \
  -H "Content-Type: application/json" -H "Idempotency-Key: bare" -d '{}'
```

Expect: health/version JSON; bridge POST **not** 503 (401/400/403 are OK without a key).

## B. Internal keys

Issue free internal keys for:

1. Owner  
2. Husband  
3. Husband’s friend  

Store keys offline (password manager). Never commit them.

## C. Three smoke handoffs

Each person posts one event (`dreamledger.bridge.handoff.v1`) with unique `task_id` / `Idempotency-Key`.

Record:

| Person | task_id | receipt_id | remaining_quota |
|--------|---------|------------|-----------------|
| Owner | | | |
| Husband | | | |
| Friend | | | |

## D. Idempotency check

Replay one successful POST unchanged → same `receipt_id`.  
Change payload, same Idempotency-Key → 409.

## E. Public probe (later)

Only after A–D are green:

1. 50c Stripe product + checkout  
2. Redeem → key with quota 1  
3. One receipt  
4. Then open NZ$19 / 100 pack  

See `MONETISATION-EVENT-PACK-19.md`.

## F. Stripe webhook

After domain is on Railway, update Stripe webhook URL to the live host and set `STRIPE_WEBHOOK_SECRET` on Railway.
