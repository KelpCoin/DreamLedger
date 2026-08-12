# First Sale Execution Gate

Target: AGENTIC-COMMERCE-READINESS-001
Price: NZD 49

1. Run npm run compile.
2. Require IP-RUNTIME-CONTRACT-PROOF.json to pass.
3. Run Start-FirstSale.ps1 with the target ProductId.
4. Require FIRST-CHECKOUT-ATTEMPT.json with a live checkout URL.
5. Send the URL only after explicit human approval.
6. Require a verified Stripe webhook before declaring revenue.
7. Require FIRST_PAYMENT_PROOF.json as the economic Fossil.

No Commander. No MTG. No simulated payment. No claimed revenue without webhook evidence.
