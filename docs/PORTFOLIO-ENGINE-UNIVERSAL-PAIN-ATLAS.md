# BROWN EYE CORTEX PORTFOLIO ENGINE
## Universal Pain Atlas + Multi-Brand Experiment System
Version: 1.0
Date: 2026-09-29

### Objective
Build digital products around recurring, boring, economically meaningful problems that can be fulfilled end-to-end by software and existing connected infrastructure. A product may live under DreamLedger or as a separate customer-facing brand. Brand separation is permitted; deceptive identity, fabricated customers, fake reviews, undisclosed legally required ownership, spam, and platform-rule evasion are not.

### Portfolio rule
Launch in controlled batches of 5-10 candidate brands only when each candidate has:
1. A concrete buyer/problem.
2. A complete machine-fulfillable transaction contract.
3. A payment boundary.
4. A delivery artifact or API result.
5. Telemetry for demand, conversion, fulfillment, refunds/errors, and repeat use.
6. A kill condition.
7. A provenance link back to the internal portfolio without exposing it publicly unless required.

A brand is not promoted because it looks busy. Promotion requires external evidence. Retirement is allowed and expected.

### Universal-product test
Prefer invariants over demographics:
messy input -> verification/normalization -> decision -> transaction/action -> evidence -> repeat.

A candidate can be broad while its first wedge is narrow. Expand only after the first wedge is fulfilled and paid.

### 100 everyday pain vectors

1. Bills do not match bank transactions.
2. Duplicate charges go unnoticed.
3. Subscriptions continue after cancellation.
4. Receipts are lost.
5. Invoices arrive with missing fields.
6. Supplier quotes are impossible to compare.
7. Purchase orders do not match invoices.
8. Delivered quantities differ from ordered quantities.
9. Customers pay the wrong invoice reference.
10. Refunds cannot be matched to original purchases.
11. Business expenses lack receipts.
12. Expense claims violate policy.
13. Small businesses cannot see recurring software spend.
14. Price increases are missed at renewal.
15. Insurance policies expire unnoticed.
16. Business licences expire unnoticed.
17. Contractors cannot prove current credentials quickly.
18. Supplier bank details change without clear verification.
19. Vendor records contain duplicate entities.
20. Company names differ across systems.
21. Addresses are inconsistent across records.
22. Phone numbers are stale or malformed.
23. Email lists contain undeliverable addresses.
24. Tax identifiers are entered incorrectly.
25. Bank account details fail validation.
26. Forms are submitted incomplete.
27. People do not know which documents an application requires.
28. Government letters are difficult to turn into next actions.
29. Contracts contain dates nobody has calendarized.
30. Renewal notice periods are forgotten.
31. Service obligations are buried in PDFs.
32. Contract versions are difficult to compare.
33. Policy changes are hard to identify.
34. Long reports hide the few decisions that matter.
35. Meeting recordings are difficult to turn into actions.
36. Emails contain order data trapped in prose.
37. PDFs contain tables that must be retyped.
38. Spreadsheets contain inconsistent column names.
39. CSV imports fail because schemas differ.
40. Data copied between systems drifts over time.
41. Teams cannot prove where a number came from.
42. Audit evidence is scattered across folders.
43. Evidence packets take hours to assemble.
44. People need a timestamped proof that a file existed.
45. People need to prove which version was current.
46. A website changes and nobody recorded the old state.
47. A supplier claims certification that cannot be quickly verified.
48. A contractor claims insurance that cannot be quickly verified.
49. A company cannot tell whether a counterparty is the correct legal entity.
50. A procurement team cannot explain why a supplier was selected.
51. Small companies struggle to prepare clean month-end reconciliations.
52. Payment processor reports do not reconcile cleanly with accounting exports.
53. Chargeback evidence is assembled too late.
54. Late invoices are discovered after cash-flow damage occurs.
55. Early-payment discounts are missed.
56. Customers dispute charges without the supporting evidence being ready.
57. Tax records require manual categorization.
58. Foreign-currency transactions lose their original rate context.
59. Shipping documents disagree with purchase records.
60. Inventory counts disagree with system quantities.
61. Product catalogues contain duplicate SKUs.
62. Supplier catalogues use incompatible units.
63. Product prices change across supplier files.
64. Minimum order quantities are buried in spreadsheets.
65. Delivery lead times are not normalized.
66. Quote terms use different currencies or tax treatments.
67. Hidden fees make nominally cheaper offers more expensive.
68. Service proposals omit scope items.
69. Tender responses arrive in incompatible formats.
70. RFP requirements are spread across attachments.
71. Applicants miss required evidence in submissions.
72. Compliance questionnaires are repetitive.
73. Vendors repeatedly answer the same onboarding questions.
74. Customers repeatedly submit the same identity documents.
75. Internal approvals get stuck waiting for one missing fact.
76. Teams cannot tell who owns the next action.
77. Renewal pipelines contain stale opportunities.
78. Sales follow-ups are missed after proposals.
79. Support tickets lack the evidence needed for resolution.
80. Warranty claims lack a complete proof bundle.
81. Returns lack the original order evidence.
82. Delivery disputes lack timestamped acceptance evidence.
83. Construction variations lack a clean before/after scope record.
84. Maintenance records are fragmented across contractors.
85. Property managers cannot reconcile supplier work with invoices.
86. Tenants cannot assemble application documents cleanly.
87. Landlords struggle to compare maintenance quotes.
88. Small businesses cannot benchmark supplier pricing.
89. Buyers cannot tell whether a quote is complete.
90. Managers cannot quickly identify anomalous spend.
91. Organizations cannot detect repeated exceptions.
92. Teams cannot turn recurring manual checks into deterministic workflows.
93. Agents need verified web facts rather than raw search results.
94. Agents need structured documents rather than PDFs.
95. Agents need entity resolution before acting on names.
96. Agents need provenance before using extracted financial data.
97. Agents need payment-aware tool calls.
98. Agents need bounded, auditable external actions.
99. Businesses need machine-readable evidence of completed work.
100. Any transaction involving multiple parties creates reconciliation, verification, exception, or evidence work that can often be productized.

### Product construction algorithm
For each candidate:
PAIN -> BUYER -> INPUT CONTRACT -> PROCESS -> OUTPUT CONTRACT -> PAYMENT -> DELIVERY -> EVIDENCE -> REPEAT -> ADJACENT PROBLEM.

Reject candidates requiring physical fulfilment, privileged credentials unavailable to the system, unlicensed professional judgment, or an unavoidable human step that has not been explicitly provisioned.

### Batch experiment
Each batch contains 5-10 genuinely different customer-facing propositions. Each gets isolated brand assets, URL surface, payment SKU, fulfillment capability, telemetry namespace, and kill switch. Shared infrastructure may exist privately.

Telemetry measures:
impressions, qualified demand signals, checkout starts, settled payments, fulfillment success, time-to-delivery, refunds, repeat purchases, acquisition source, geography, business size where lawfully available, and human minutes consumed.

No vanity metric can promote a brand. A settled external payment and successful machine fulfillment are stronger signals than traffic.

### Two-week decision gate
At the end of a test window, evaluate each brand against the same evidence contract. Continue, modify, hold, or retire. Do not rank candidates by a fabricated score. Use explicit factual thresholds defined before the test. Preserve the data and reason for every retirement.

### Architecture
Public brands may be disconnected from DreamLedger.org. Internal portfolio control remains centralized in the existing Brown Eye Cortex/CUBE control plane. CUBE governs execution. Gauntlet challenges candidate safety and integrity. Elohim proposes. Truth Oracle establishes evidence boundaries. Existing economic state machine and fencing tokens govern transactions. No second economic ledger is permitted.

### Economic truth
VERIFIED_EXTERNAL_REVENUE = NZ$0.00
SETTLED_EXTERNAL_PAYMENTS = 0
INDEPENDENT_EXTERNAL_BUYERS = 0
VERIFIED_ECONOMIC_OUTCOMES = 0

Brand creation, DNS, traffic, leads, proposals, checkout creation, and internal execution never change these values.

### Automation boundary
Automate discovery, qualification, content preparation, site deployment, checkout creation, intake, fulfillment, delivery, telemetry, reconciliation, and retirement where technically and legally possible. Stop at genuine external authority gates. Never automate around platform restrictions.

### Computer availability
The portfolio is designed to degrade gracefully when the local computer is unavailable. Local inference is an optimization, not an economic dependency. A physical power-on action cannot be performed by a remote software control plane unless a connected power-management mechanism exists; the system must report this as an infrastructure state rather than pretending the machine was started.

### Immediate implementation target
1. Maintain a machine-fulfillable product registry.
2. Generate isolated brand surfaces from approved product definitions.
3. Attach each surface to an existing payment and fulfillment path.
4. Run automated validation and deployment.
5. Emit telemetry into existing governed infrastructure.
6. Promote or retire using evidence.
7. Expand the winning invariant into adjacent transaction surfaces.

This document is canonical portfolio policy. It does not create economic outcomes by itself.
