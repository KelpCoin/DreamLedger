# Buyer Frontier Checkpoint — 2026-09-29

## Economic state

VERIFIED_EXTERNAL_REVENUE = NZ$0.00
SETTLED_EXTERNAL_PAYMENTS = 0
INDEPENDENT_EXTERNAL_BUYERS = 0
VERIFIED_ECONOMIC_OUTCOMES = 0

This document records demand evidence only. No job application, message, purchase, payment, or revenue event was created by this checkpoint.

## Verified distribution evidence

### Upwork official MCP

Upwork's official MCP Server currently documents freelancer job search plus proposal drafting and submission. Upwork states that write actions are drafted first and require confirmation, and that Connects apply only when the user confirms.

Source: https://www.upwork.com/ai/mcp

Operational rule:
DISCOVER -> DRAFT -> HUMAN CONFIRMATION -> SUBMIT -> EXTERNAL RESPONSE

No automated proposal submission is authorized by this checkpoint.

### Live buyer demand

1. Purchasing/Procurement Specialist
URL: https://www.upwork.com/freelance-jobs/apply/Purchasing-Procurement-Specialist_~022095665134294165259/
Observed: current listing, posted 4 weeks ago.
Demand: compare supplier quotes, monitor price changes, find best pricing, vendor management and purchase orders.
Observed rate: US$20–35/hour.
Observed activity: 20–50 proposals, 6 interviews.
Fit: QUOTE-COMPARE-49 can address the quote-comparison component, but the listing is broader than quote normalization.

2. Sourcing & Operations Manager — Building Materials Wholesale
URL: https://www.upwork.com/freelance-jobs/apply/Sourcing-Operations-Manager-Building-Materials-Wholesale_~022086901357468512525/
Observed: current listing.
Demand: contact suppliers, compare supplier quotes, freight, lead times and terms, organize supplier information, and prepare repeatable procurement processes.
Fit: strong demand signal for quote normalization, but the role includes supplier contact and negotiation outside current toll-booth scope.

3. Procurement & Sourcing Manager — Global Construction Materials
URL: https://www.upwork.com/freelance-jobs/apply/Procurement-Sourcing-Manager-Global-Construction-Materials_~022089286423909127814/
Observed: current listing.
Demand: RFQs, supplier quotations, commercial comparison, MOQ, pricing, production schedules, payment terms and product/specification matching.
Fit: strong quote-normalization signal, but broader sourcing responsibilities exceed current fixed-price primitive.

## Existing market-priced service evidence

Current Upwork Project Catalog listings independently expose supplier quote comparison as a purchasable service:

- Starter quote-comparison offerings observed at US$25, US$29 and US$59 depending on scope.
- Higher tiers observed at US$79, US$119, US$149 and US$299.
- Deliverables include normalized bid tables, source references, exceptions, commercial-risk notes and decision summaries.

This supports the existing NZ$49 one-time offer as a test price, not as proof of willingness to pay.

## Proposal draft rule

For jobs where quote comparison is only one component, proposal copy must not claim supplier sourcing, negotiation, purchasing authority, legal advice, or savings guarantees.

Draft positioning:

" I can turn the supplier quotations you already have into one comparable decision table: normalize line items, units, currencies, MOQ, freight, lead time and payment terms; preserve source references; and flag missing or non-comparable fields. I would keep the original quotations unchanged and separate stated figures from calculations. The output is a decision-ready comparison, not a purchasing decision."

The draft must be reviewed and submitted by an authorized human through the approved Upwork mechanism.

## Direct checkout rule

The NZ$49 Stripe checkout remains a separate direct-sales surface. It must not be used to move an Upwork buyer off-platform when the engagement originates on Upwork. Upwork-originated work should use Upwork's own contract/payment mechanism.

## Next state

BUYER_DISCOVERY = ACTIVE
BUYER_DRAFT = READY
EXTERNAL_SUBMISSION = HUMAN_GATE
DIRECT_CHECKOUT = LIVE
REVENUE_TRUTH = ZERO_UNCHANGED
