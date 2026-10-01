# DreamLedger Economic Engine

The Economic Engine is the passive observation layer for commercial experiments.

It does not create revenue. It detects evidence of revenue and preserves the evidence needed to decide what deserves more capital, distribution, automation, or fulfilment effort.

## Permanent loop

SIGNAL -> OFFER -> CHECKOUT -> PAID EVENT -> FULFILMENT -> OUTCOME -> LEARNING

The first permanent module is the Economic Event Probe.

## Economic Event Probe

Workflow: `.github/workflows/economic-event-probe.yml`

Implementation: `ops/commerce/probe-economic-events.mjs`

Registry: `ECONOMIC-ENGINE/EXPERIMENT-REGISTRY.json`

Cadence: every 15 minutes plus manual dispatch.

Authority: live Stripe settlement evidence.

Output:

- `proof/commerce/latest-economic-event-probe.json`
- `proof/commerce/latest-economic-event-probe.sha256`
- GitHub Actions artifact `economic-event-probe-{run_id}`

## What it watches

The registry intentionally contains multiple experiments at different economic depths:

- low-ticket diagnostics
- merchant readiness audits
- personal commerce policy setup
- recurring evidence observation
- recurring evidence analysis
- recurring operator access
- bounded architecture audits
- the isolated MTG diagnostic

The probe also discovers live Stripe payment links marked `sale_ready`, so a newly created approved offer can be observed without rewriting the observer.

## Safety

The module is read-only against Stripe and Airtable.

It does not:

- publish anything
- activate an offer
- create a customer
- create a payment
- refund a payment
- mark an order fulfilled
- alter settlement authority
- cross silo boundaries

A paid Checkout Session is an economic event. A payment link is only an opportunity.

## Decision rule

The factory may expand only when evidence justifies expansion.

A useful next action is selected from observed evidence using:

Expected Value x Probability x Speed x Automation

penalized by:

Risk + Human Labour + Capital Required

No architecture claim substitutes for a real economic event.
