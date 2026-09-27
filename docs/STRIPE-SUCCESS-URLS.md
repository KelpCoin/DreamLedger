# Stripe Payment Link success URLs

Payment Links are configured in the **Stripe Dashboard**. Repo JSON alone does not change live redirects.

## Recommended URLs

### Commander Deck Diagnostic (`plink` for NZ$29)

**Success:**
```
https://dreamledger.org/diagnostic-input.html?session_id={CHECKOUT_SESSION_ID}
```

Alternate (thank-you then decklist):
```
https://dreamledger.org/success.html?session_id={CHECKOUT_SESSION_ID}
```

**Cancel:**
```
https://dreamledger.org/cancel.html
```

### Other products (billboard, Discord kit, seller audit)

**Success:**
```
https://dreamledger.org/success.html?session_id={CHECKOUT_SESSION_ID}
```

**Cancel:**
```
https://dreamledger.org/cancel.html
```

## Why

Borrowed from [stripe-samples/checkout-one-time-payments](https://github.com/stripe-samples/checkout-one-time-payments):
clear success page, clear cancel recovery, session id in the URL for fulfillment.

Without this, buyers can pay and land on a broken Supabase function or a blank browser tab — killing delivery and reviews.
