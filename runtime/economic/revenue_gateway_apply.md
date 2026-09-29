# Revenue Gateway Apply / Live Verification

Target: QUOTE-COMPARE-49.

1. Inspect the live Supabase schema first. Confirm the existing revenue_catalog, revenue_orders, revenue_entitlements, fulfillment_requests, and any existing evidence/control structures. Do not blindly apply this migration.

2. The live schema inspection for this bundle found:
   - public.revenue_catalog exists and has sku_id, price_nzd, stripe_product_id, stripe_price_id, stripe_payment_link, active, and fulfillment_type.
   - public.revenue_orders exists and is tied to Stripe settlement observations.
   - public.revenue_entitlements exists.
   - public.fulfillment_requests exists.
   - public.commerce_cells exists but currently has no QUOTE-COMPARE-49 row.
   - public.revenue_catalog currently contains QUOTE-COMPARE-49.
   These facts were observed live on 2026-09-29 and must be rechecked before mutation.

3. Apply the migration only after schema compatibility is confirmed. It creates configuration/control state only. It does not write revenue, orders, entitlements, fulfillment requests, evidence, or economic outcomes.

4. Deploy supabase/functions/revenue-gateway/index.ts with types.ts after checking current Edge Function conventions. Do not replace quote-intake or quote-fulfillment.

5. Run the read-only probe. It must report JSON with truth_status=UNVERIFIED until independent production evidence exists.

6. Run gateway status and capability checks. The gateway must distinguish infrastructure reachability from fulfillment capability.

7. Verify the existing quote path:
   Stripe payment boundary -> revenue settlement record -> entitlement -> fulfillment request -> quote-intake -> quote-fulfillment -> storage output.
   Do not create a checkout session or order for this test.

8. Verify that the current Stripe payment link and revenue_catalog contract agree. The live Stripe payment link metadata currently says fulfillment=manual_decision_packet, while revenue_catalog.fulfillment_type currently says automated_quote_comparison. Treat this as COMMERCIAL_CONTRACT_CONFLICT / HUMAN_POLICY_REQUIRED until resolved by an authorized operator. Do not silently change the buyer promise.

9. Verify that no economic scoreboard values changed:
   VERIFIED_EXTERNAL_REVENUE = NZ$0.00
   SETTLED_EXTERNAL_PAYMENTS = 0
   INDEPENDENT_EXTERNAL_BUYERS = 0
   VERIFIED_ECONOMIC_OUTCOMES = 0

10. Verify no external dispatch occurred, no Stripe payment was created, no buyer was contacted, and no evidence chain was promoted to VERIFIED.

11. ATOMICITY_GAP: the existing Stripe webhook creates settlement/order/entitlement/fulfillment records after Stripe reports a paid checkout. A pre-check cannot make this atomic with the provider. Therefore checkout-check is an eligibility gate, not a payment guarantee. The authoritative post-payment path remains the Stripe webhook plus fulfillment state. Do not describe the frontend status check as a guarantee.

12. QUEUED is not payment-authorized by this bundle. If the commercial contract is not explicitly delayed-fulfillment compatible, the gateway returns HUMAN_POLICY_REQUIRED and can_accept_payment=false.

13. Return exact live evidence:
   - migration result
   - deployed function version/hash
   - GET /status/QUOTE-COMPARE-49 response
   - POST /checkout-check response
   - POST /fulfill-check response
   - relevant live catalog/payment-link comparison
   - scoreboard before/after
   - evidence that no payment/order/dispatch was created
   - any errors verbatim

Do not infer success from file creation.
