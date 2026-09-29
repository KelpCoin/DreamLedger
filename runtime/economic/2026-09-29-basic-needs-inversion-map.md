# DreamLedger Basic-Needs Inversion Map
Date: 2026-09-29
Observed substrate: commit ba92693917a540b44f5510243aa96333443c842b

## Finding

The strongest reusable economic primitive in the existing substrate is a deterministic money-bearing document decision engine:

SOURCE DOCUMENTS -> EXTRACT -> NORMALIZE -> COMPARE/RECONCILE -> FLAG EXCEPTIONS -> EVIDENCE PACKET -> DELIVERY

This already exists in production as QUOTE-COMPARE-49. It accepts 2-5 supplier documents, extracts commercial fields, preserves unknowns, hashes source artifacts, and produces HTML/CSV evidence-backed output through automated fulfillment.

The economic inversion is simple: do not sell AI. Sell removal of an expensive decision bottleneck.

## Basic-needs map

| Need | Paid pain | Existing substrate fit | Market signal | Machine distance |
|---|---|---|---|---|
| Food / household essentials | Find the cheapest practical basket | Price-comparison research exists, but no differentiated live grocery fulfillment | NZ already has free grocery comparison products | LOW |
| Utilities / bills | Avoid overpaying | Comparison/evidence primitives fit, but NZ power comparison is already free/public | Billy and Powerswitch provide free comparison/switching | LOW |
| Safety / loss prevention | Catch an overcharge, duplicate, bad term, or mismatch before money leaves | Reconciliation, evidence, extraction, truth boundary | Invoice/AP reconciliation is a paid service category | HIGH |
| Business cashflow | Get invoices right and reduce admin | Existing Python extraction, Supabase state, evidence and worker substrate | NZ eInvoicing research quantifies large invoice-processing savings | HIGH |
| Procurement | Choose among quotes without manual reconciliation | Fully implemented automated quote comparison | Live Upwork quote-comparison services are paid | VERY HIGH |
| Supplier management | Detect price/MOQ/lead-time changes | Existing quote comparison and supplier-price-list surface | Live supplier price-list matching services exist | HIGH |
| Seller income | Stop losing margin to fees, shipping and pricing | Seller Profit Audit exists at NZ$29, but fulfillment is manual | Paid seller-economics services exist | MEDIUM |
| Entertainment / hobby | Improve a game/deck/collection | Automated Commander diagnostic exists at NZ$29 | Existing MTG buyer history and offer | HIGH within niche |
| Convenience | Remove repetitive clerical work | Extraction, normalization, evidence, fulfillment | SMB admin/document-processing demand is documented | HIGH |

## The reusable pattern

The basic human need is often not the object itself.

For a business:
- Food -> purchasing
- Housing -> contractors and suppliers
- Safety -> verification
- Money -> avoiding leakage
- Time -> removing clerical comparison
- Stability -> knowing which number or term is actually correct

DreamLedger already sits at the intersection of money + time + uncertainty.

That is stronger than attempting to compete directly with grocery, power, or entertainment aggregators where established free services already exist.

## Highest-convergence offer family

### MONEY LEAK / DECISION CHECK

Input:
- invoices
- quotes
- price lists
- purchase orders
- contracts/rate sheets
- statements
- supplier documents

Output:
- normalized facts
- arithmetic/reconciliation checks
- differences
- missing fields
- source hashes
- evidence-backed exception report
- clear attention list

Value proposition:

"Before you pay, send us the documents. We show you what does not match."

This is an inversion of the current quote-comparison product, not a new economic core.

## Already present

1. PDF/CSV/JSON/Markdown intake for quote comparison.
2. Source hashing and evidence capture.
3. Deterministic extraction of supplier, totals, MOQ, lead time and payment terms.
4. Unknown preservation rather than invented values.
5. HTML/CSV decision-packet generation.
6. Stripe payment boundary.
7. Automated post-payment fulfillment worker.
8. Supabase fulfillment state and evidence references.
9. Truth boundary that excludes internal activity from revenue.
10. Niche landing surfaces for construction, ecommerce, electrical, hospitality, import, lighting, manufacturing, operations, packaging and wholesale.

## Not proven

- Independent external buyer.
- Settled payment attributed to an independent buyer.
- Completed QUOTE-COMPARE-49 fulfillment from a real paid intake.
- Automated invoice/contract line-item reconciliation.
- A differentiated consumer basic-needs product.

No scoreboard change is justified.

## External evidence

- Live Upwork quote-comparison services currently advertise US$49/99/159 and US$25/59/119 tiers.
- Live Upwork invoice-reconciliation services advertise starter work around US$149 and higher tiers, including invoice-versus-contract/rate-sheet checks with evidence-backed exception reports.
- NZ eInvoicing research reports more than 300 million B2B invoices annually and estimates at least 16 minutes saved per invoice, valued at at least NZ$11 per invoice.
- Consumer grocery and electricity comparison are already served by free NZ products, making them weaker first-dollar wedges for this substrate.

## Economic conclusion

The useful reusable transformation is:

messy money-bearing inputs -> verified differences -> action-ready decision

The machine does not need another swarm. It needs a buyer with an existing money-bearing document problem, a fixed deliverable, a payment boundary, automated fulfillment, and independent evidence.

The closest existing implementation is QUOTE-COMPARE-49.

The strongest inversion is to extend the same extraction/evidence substrate from:

"Which supplier quote should I choose?"

to:

"What is wrong, different, or expensive in the document I am about to pay?"

That targets the economic basics of preserving money, time and certainty without requiring a new economic core.

## Guardrails

- No fake buyer.
- No self-purchase.
- No fabricated savings.
- No automatic external contact.
- No automatic financial action.
- No n8n.
- No new economic ledger.
- No new Truth system.
- No consumer claim of savings until source data proves it.
