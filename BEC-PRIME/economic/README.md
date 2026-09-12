# DreamLedger Economic Cockpit

The Economic Cockpit is the local money-facing control surface for DreamLedger.

## One command

From the DreamLedger repository:

```text
npm run economic:cockpit
```

Or double-click:

```text
BEC-PRIME/economic/Run-Economic-Cockpit.cmd
```

## What it proves

Mandatory observation is limited to the commercial evidence chain:

1. DreamLedger production root is observable.
2. Billboard page is observable.
3. Machine-readable offers are observable.
4. Stripe live charges are observable.
5. Payment evidence is derived only from the valid Stripe charges response.

Connectivity failure and HTTP 5xx produce `INVALID`.
A mandatory 4xx produces `CONTRADICTED` so the report identifies a specific missing or incorrect surface.
A valid Stripe response with zero paid live charges is a valid result: `VALID` with `NZ$0`.

## What it does not do

It does not send email, send outreach, create a payment, create a Stripe Payment Link, deploy production, write Supabase records, resurrect MTG work, or invent revenue.

## Acquisition loop

When `DREAMLEDGER_PROSPECTS_CSV` exists, the cockpit reads the prospect feed, scores the supplied evidence, and creates an approval queue. The queue is never sent automatically.

Default prospect feed:

```text
D:\BrownEyeCortex\Prospects\prospects.csv
```

Override with:

```text
DREAMLEDGER_PROSPECTS_CSV
```

The resulting `OUTREACH_QUEUE.csv` is written beside the evidence report. Each opportunity carries `approval_required=true` and `send_status=NOT_SENT`.

## Evidence

Runs are stored beneath:

```text
D:\BrownEyeCortex\EconomicCockpit
```

The latest machine-readable summary is:

```text
D:\BrownEyeCortex\EconomicCockpit\latest.json
```

## Economic doctrine

`REAL BUYER -> STRIPE LIVE PAYMENT -> FULFILMENT -> PROOF`

The cockpit may identify opportunities, but it never promotes opportunity value into revenue. Only live Stripe payment evidence can establish BusinessTruth.
