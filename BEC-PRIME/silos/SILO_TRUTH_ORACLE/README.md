# DreamLedger Truth Oracle silo

Permanent public evidence-evaluation and progressive-transparency silo.

Core rule: payment changes disclosure depth, never the underlying truth calculation.

Public layer: basic verdict and evidence explanation.
Signal: NZ$4.99/month.
Intelligence: NZ$7.99/month.
Deep Evidence: NZ$9.99/month.

Stripe products and recurring Prices are live in the DreamLedger production Stripe account and are identified in config.json.

The public route is `/truth-oracle`.

The commerce route creates Stripe Billing Checkout Sessions from the server. It does not accept client-supplied prices or Stripe IDs. Access verification is based on the Stripe Checkout Session and its subscription state.

This silo does not modify the underlying Truth Oracle verdict based on entitlement. Private intellectual property, credentials, private customer material and protected source data remain excluded from public disclosure.

Future webhook-backed entitlement persistence, account binding and historical calibration are separate bounded upgrades. Do not infer that they are implemented merely because this silo exists.
