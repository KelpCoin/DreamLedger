# DreamLedger Economic Cockpit 2.0

The Economic Cockpit is the local money-facing control surface for the active DreamLedger Billboard cell.

## One command

From the DreamLedger repository:

```text
npm run economic:cockpit
```

Or double-click:

```text
BEC-PRIME/economic/Run-Economic-Cockpit.cmd
```

The runner deliberately refuses to start when `STRIPE_SECRET_KEY` is present or `STRIPE_READONLY_KEY` is absent. Use a restricted Stripe key with read-only access suitable for Payment Links, Checkout Sessions, Payment Intents, Charges and Balance observation. Never put a full live secret in the cockpit.

## Economic truth

The cockpit does not treat every paid charge in the Stripe account as DreamLedger revenue.

Attribution is:

```text
DreamLedger Billboard Payment Link
  -> paid live Checkout Session
  -> Payment Intent
  -> paid live Charge
  -> BusinessTruth
```

Only charges reached through that chain are counted as Billboard revenue. Unrelated Stripe account activity is excluded.

A valid live checkout with no attributable paid charge is a valid result: `VERIFIED_ZERO_BILLBOARD_PAYMENTS` and `NZ$0`.

## Approval is a record, not a flag

Each outreach opportunity receives a frozen authorization record containing the exact action type, recipient, amount, currency, offer, payment link, message body, creation time, expiry, nonce and hashes.

The execution gate is:

```text
node BEC-PRIME\economic\AssertAuthorizationRecord.js <authorization.json> <proposed.json>
```

It refuses execution if the record is not explicitly approved, has expired, its immutable snapshot hash has changed, or any protected field differs from the approved snapshot. A changed prospect row cannot inherit an old approval.

The cockpit itself never sends outreach. It only prepares these records.

## Acquisition scoring

Prospects are scored on three independent axes:

- `intent_score`: evidence the buyer is in-market now
- `fit_score`: match to the Billboard offer and target market
- `engagement_score`: evidence of interaction with DreamLedger

The queue is ordered by intent first, then fit, then engagement. An outreach trigger requires meaningful fit plus current intent. A high-fit prospect with no intent is not treated as hot.

Expected prospect columns include:

```text
name,business,website,email,country,market,location,website_active,intent_score,intent_signals,intent_date,engagement_score,engagement_signal,message_body
```

## What it does not do

It does not send email, send outreach, create a payment, create a Stripe Payment Link, deploy production, write Supabase records, resurrect MTG work, or invent revenue.

MTG is outside this commercial cell.

## Evidence

Runs are stored beneath:

```text
D:\BrownEyeCortex\EconomicCockpit
```

The latest machine-readable summary is:

```text
D:\BrownEyeCortex\EconomicCockpit\latest.json
```

Each run contains production evidence, offer evidence, checkout evidence, attributable payment evidence, acquisition evidence, the outreach queue, and immutable authorization snapshots.

## Economic doctrine

```text
REAL BUYER -> LIVE BILLBOARD CHECKOUT -> SETTLED PAYMENT -> FULFILMENT -> PROOF
```

Opportunity count, pipeline value, intent score, Stripe account-wide charges, and self-payments are not revenue.
