# Universal Pain Observatory: P301-P400

Status: CANONICAL RESEARCH INPUT
Date: 2026-09-29
Purpose: extend the existing 300-vector corpus with 100 non-duplicative B2B transaction pains across financial, procurement, marketplace, logistics, compliance, data, service and trust substrates.

## Corpus

### P301 — Missed invoice due dates
- Vector: accounts_payable
- Pain: Find obligations that will incur fees or service interruption before they do.
- Reusable primitive: reminder + evidence

### P302 — Unclear customer credit limits
- Vector: receivables
- Pain: Turn scattered payment history and terms into a documented credit decision.
- Reusable primitive: decision + evidence

### P303 — Customers paying the wrong bank account
- Vector: payments
- Pain: Detect beneficiary/account mismatches before settlement.
- Reusable primitive: verification + anomaly

### P304 — Supplier invoices sent to the wrong entity
- Vector: accounting
- Pain: Resolve legal-entity mismatches before posting.
- Reusable primitive: entity resolution

### P305 — Purchase requests lacking specifications
- Vector: procurement
- Pain: Turn vague requests into structured buying requirements.
- Reusable primitive: requirements extraction

### P306 — Buyers receiving incomplete quotes
- Vector: procurement
- Pain: Detect missing price, quantity, delivery or warranty fields before comparison.
- Reusable primitive: completeness check

### P307 — Quotes with incompatible units
- Vector: procurement
- Pain: Normalize cartons, kilograms, hours, metres and other units for comparison.
- Reusable primitive: normalization

### P308 — Hidden freight in supplier pricing
- Vector: procurement
- Pain: Expose freight and delivery assumptions in quoted totals.
- Reusable primitive: cost normalization

### P309 — Supplier quotes expiring unnoticed
- Vector: procurement
- Pain: Track expiry dates and alert before a buying decision becomes stale.
- Reusable primitive: freshness monitoring

### P310 — Price increases buried in emails
- Vector: procurement
- Pain: Extract price changes from supplier communications and preserve evidence.
- Reusable primitive: change detection

### P311 — Supplier substitutions without approval
- Vector: procurement
- Pain: Compare delivered substitutions with the agreed specification.
- Reusable primitive: acceptance check

### P312 — Invoices referencing obsolete purchase orders
- Vector: procurement
- Pain: Match documents against the currently valid order version.
- Reusable primitive: version resolution

### P313 — Business buyers unable to compare service proposals
- Vector: services
- Pain: Normalize scope, exclusions, assumptions and fees across proposals.
- Reusable primitive: proposal comparison

### P314 — Service quotes hiding recurring fees
- Vector: services
- Pain: Separate one-time, recurring and usage-based charges.
- Reusable primitive: cost decomposition

### P315 — Contractors billing outside agreed scope
- Vector: services
- Pain: Compare invoice line items against contracted scope.
- Reusable primitive: obligation matching

### P316 — Work completed but acceptance never recorded
- Vector: services
- Pain: Capture structured acceptance evidence and outstanding exceptions.
- Reusable primitive: acceptance record

### P317 — Change requests lost in chat
- Vector: project_delivery
- Pain: Turn informal changes into dated, attributable change records.
- Reusable primitive: commitment extraction

### P318 — Project handoffs lose commercial context
- Vector: project_delivery
- Pain: Create a compact packet linking scope, price, approvals and deliverables.
- Reusable primitive: handoff packet

### P319 — Clients cannot find current project documents
- Vector: project_delivery
- Pain: Resolve the authoritative document version and expose provenance.
- Reusable primitive: document authority

### P320 — Repeated requests for the same business information
- Vector: operations
- Pain: Create reusable verified business-information packets.
- Reusable primitive: data passport

### P321 — Forms asking for information already supplied
- Vector: operations
- Pain: Detect duplicate questions and prefill verified answers.
- Reusable primitive: data reuse

### P322 — Vendor onboarding stalled by one missing document
- Vector: vendor_management
- Pain: Identify the exact missing requirement and request it once.
- Reusable primitive: completeness workflow

### P323 — Expired supplier certificates discovered too late
- Vector: vendor_management
- Pain: Monitor credentials and surface expiry before transactions.
- Reusable primitive: expiry monitoring

### P324 — Insurance certificates do not match contract requirements
- Vector: vendor_management
- Pain: Compare policy evidence with required coverage.
- Reusable primitive: compliance comparison

### P325 — Contractor licences vary by jurisdiction
- Vector: vendor_management
- Pain: Map service location and job type to required credentials.
- Reusable primitive: rule mapping

### P326 — Supplier names differ across systems
- Vector: master_data
- Pain: Resolve aliases to one canonical legal entity.
- Reusable primitive: entity resolution

### P327 — Customer records duplicated after imports
- Vector: master_data
- Pain: Detect probable duplicates and produce a merge decision set.
- Reusable primitive: deduplication

### P328 — Product SKUs differ between suppliers
- Vector: catalog
- Pain: Map supplier identifiers to a canonical product identity.
- Reusable primitive: product matching

### P329 — Product descriptions omit critical attributes
- Vector: catalog
- Pain: Detect missing attributes required for buying decisions.
- Reusable primitive: catalog completeness

### P330 — Business listings become stale
- Vector: marketplace
- Pain: Detect stale price, stock, contact and credential information.
- Reusable primitive: freshness monitoring

### P331 — Buyers cannot tell whether a listing is still available
- Vector: marketplace
- Pain: Track listing freshness and seller confirmation.
- Reusable primitive: availability verification

### P332 — B2B buyers receive irrelevant marketplace results
- Vector: marketplace
- Pain: Match listings to structured requirements rather than keywords alone.
- Reusable primitive: requirement matching

### P333 — Sellers answer the same buyer questions repeatedly
- Vector: marketplace
- Pain: Turn listing questions into reusable structured facts.
- Reusable primitive: FAQ extraction

### P334 — Negotiated terms disappear after chat
- Vector: marketplace
- Pain: Convert accepted commercial terms into a transaction record.
- Reusable primitive: agreement capture

### P335 — Marketplace sellers cannot prove delivery
- Vector: marketplace
- Pain: Package shipment, receipt and acceptance evidence.
- Reusable primitive: delivery proof

### P336 — Buyers cannot prove what they ordered
- Vector: marketplace
- Pain: Create an immutable order specification snapshot.
- Reusable primitive: order evidence

### P337 — Partial deliveries create reconciliation work
- Vector: logistics
- Pain: Match received quantities against ordered quantities.
- Reusable primitive: partial reconciliation

### P338 — Freight damage evidence is scattered
- Vector: logistics
- Pain: Assemble timestamped photos, shipment records and acceptance notes.
- Reusable primitive: evidence packet

### P339 — Delivery appointments require endless messages
- Vector: logistics
- Pain: Collect constraints and propose compatible appointment windows.
- Reusable primitive: scheduling

### P340 — Pickup instructions are inconsistent
- Vector: logistics
- Pain: Normalize site access, contact and handling instructions.
- Reusable primitive: instruction normalization

### P341 — Returns lack a shared reason code
- Vector: returns
- Pain: Standardize return reasons and evidence across sellers.
- Reusable primitive: classification

### P342 — Refund amounts do not match returned goods
- Vector: returns
- Pain: Reconcile return quantities, fees and refunds.
- Reusable primitive: financial reconciliation

### P343 — Warranty claims lack required evidence
- Vector: warranty
- Pain: Identify missing purchase and failure evidence before submission.
- Reusable primitive: completeness

### P344 — Warranty eligibility is unclear
- Vector: warranty
- Pain: Resolve purchase date, coverage term and exclusions.
- Reusable primitive: obligation extraction

### P345 — Repair quotes are difficult to compare
- Vector: maintenance
- Pain: Normalize parts, labour, warranty and turnaround.
- Reusable primitive: quote comparison

### P346 — Maintenance history is trapped in invoices
- Vector: maintenance
- Pain: Extract service events into a portable asset history.
- Reusable primitive: record extraction

### P347 — Businesses forget recurring maintenance
- Vector: maintenance
- Pain: Generate maintenance obligations from asset records.
- Reusable primitive: obligation tracking

### P348 — Critical spare parts are hard to identify
- Vector: maintenance
- Pain: Match equipment models to compatible parts.
- Reusable primitive: compatibility matching

### P349 — Used equipment condition descriptions vary wildly
- Vector: asset_market
- Pain: Normalize condition into comparable fields and evidence.
- Reusable primitive: condition normalization

### P350 — Used assets have uncertain provenance
- Vector: asset_market
- Pain: Assemble ownership, service and acquisition evidence.
- Reusable primitive: provenance packet

### P351 — Surplus inventory sits unseen
- Vector: asset_market
- Pain: Match idle stock to buyers with compatible requirements.
- Reusable primitive: inventory matching

### P352 — Businesses cannot price surplus confidently
- Vector: asset_market
- Pain: Benchmark comparable listings and documented transaction signals.
- Reusable primitive: price discovery

### P353 — Liquidation buyers need bulk lots
- Vector: asset_market
- Pain: Aggregate compatible surplus into structured lots.
- Reusable primitive: lot formation

### P354 — Business closures require asset disposition
- Vector: asset_market
- Pain: Create inventory, valuation and disposition packets.
- Reusable primitive: liquidation workflow

### P355 — Buyers need multiple comparable offers quickly
- Vector: rfq
- Pain: Issue structured RFQs to qualified suppliers.
- Reusable primitive: RFQ orchestration

### P356 — Suppliers waste time answering poorly specified RFQs
- Vector: rfq
- Pain: Convert buyer requirements into supplier-ready request forms.
- Reusable primitive: requirement normalization

### P357 — RFQ responses arrive in incompatible formats
- Vector: rfq
- Pain: Normalize response fields automatically.
- Reusable primitive: response normalization

### P358 — Buyers lose track of who was invited
- Vector: rfq
- Pain: Maintain an invitation and response ledger.
- Reusable primitive: workflow tracking

### P359 — Supplier non-response is invisible
- Vector: rfq
- Pain: Detect unanswered RFQs and stale response windows.
- Reusable primitive: exception detection

### P360 — Negotiation has no commercial audit trail
- Vector: negotiation
- Pain: Capture offer, counteroffer and acceptance history.
- Reusable primitive: transaction evidence

### P361 — Terms differ between quote and invoice
- Vector: settlement
- Pain: Detect commercial drift before payment.
- Reusable primitive: reconciliation

### P362 — Credits promised but never applied
- Vector: settlement
- Pain: Track credit commitments through invoice settlement.
- Reusable primitive: obligation reconciliation

### P363 — Marketplace fees are difficult to reconcile
- Vector: settlement
- Pain: Match orders, fees, refunds and payouts.
- Reusable primitive: settlement reconciliation

### P364 — Seller payout amounts are unexplained
- Vector: settlement
- Pain: Explain gross-to-net payout differences from transaction evidence.
- Reusable primitive: margin reconciliation

### P365 — Buyers cannot reconcile multiple payment methods
- Vector: settlement
- Pain: Normalize card, bank, wallet and marketplace payments.
- Reusable primitive: payment normalization

### P366 — Foreign-currency supplier totals are misleading
- Vector: settlement
- Pain: Preserve source currency and dated FX evidence.
- Reusable primitive: FX normalization

### P367 — Tax treatment differs between supplier quotes
- Vector: tax
- Pain: Compare tax-inclusive and tax-exclusive commercial totals.
- Reusable primitive: tax normalization

### P368 — Invoices lack required tax fields
- Vector: tax
- Pain: Detect incomplete tax evidence before posting.
- Reusable primitive: tax validation

### P369 — Businesses miss filing evidence
- Vector: tax
- Pain: Assemble source transactions and supporting documents for filing.
- Reusable primitive: evidence assembly

### P370 — Expense policies are hard to apply consistently
- Vector: finance
- Pain: Turn policy language into checkable transaction rules.
- Reusable primitive: policy validation

### P371 — Employee expenses lack supporting receipts
- Vector: finance
- Pain: Match claims to receipts and flag unsupported amounts.
- Reusable primitive: evidence matching

### P372 — Recurring charges escape budget review
- Vector: finance
- Pain: Detect recurring spend changes and unused services.
- Reusable primitive: spend monitoring

### P373 — Cloud bills contain unexplained spikes
- Vector: finance
- Pain: Compare current usage/cost against historical baselines.
- Reusable primitive: anomaly detection

### P374 — Telecom bills contain unused services
- Vector: finance
- Pain: Map plans, lines and usage to identify waste.
- Reusable primitive: cost audit

### P375 — Insurance renewals are hard to compare
- Vector: finance
- Pain: Compare premium, limits, exclusions and changes between periods.
- Reusable primitive: policy comparison

### P376 — Energy bills contain unexplained anomalies
- Vector: utilities
- Pain: Detect abnormal usage or billing changes.
- Reusable primitive: anomaly detection

### P377 — Waste invoices lack disposal evidence
- Vector: utilities
- Pain: Match disposal charges to manifests and certificates.
- Reusable primitive: evidence reconciliation

### P378 — Regulatory changes create unclear business actions
- Vector: compliance
- Pain: Extract affected obligations and assign next actions.
- Reusable primitive: obligation extraction

### P379 — Compliance evidence is spread across systems
- Vector: compliance
- Pain: Assemble a dated evidence index from authoritative sources.
- Reusable primitive: evidence indexing

### P380 — Audit requests arrive as long unstructured lists
- Vector: audit
- Pain: Convert requests into owners, evidence and deadlines.
- Reusable primitive: requirement extraction

### P381 — Auditors receive duplicate evidence
- Vector: audit
- Pain: Detect duplicate submissions and link them to requirements.
- Reusable primitive: deduplication

### P382 — Evidence becomes stale during long audits
- Vector: audit
- Pain: Monitor evidence freshness and flag superseded records.
- Reusable primitive: freshness monitoring

### P383 — Security questionnaires repeat across customers
- Vector: security
- Pain: Reuse verified answers with source provenance.
- Reusable primitive: evidence reuse

### P384 — Customers ask for unsupported security claims
- Vector: security
- Pain: Map claims to actual evidence and expose gaps.
- Reusable primitive: claim verification

### P385 — Access reviews require spreadsheet chasing
- Vector: security
- Pain: Collect current access evidence and identify unresolved exceptions.
- Reusable primitive: access review

### P386 — Former staff retain unreviewed access
- Vector: security
- Pain: Compare offboarding records with current account evidence.
- Reusable primitive: offboarding reconciliation

### P387 — Privacy requests lack complete source discovery
- Vector: privacy
- Pain: Locate relevant customer records and document search coverage.
- Reusable primitive: data discovery

### P388 — Retention rules are hard to monitor
- Vector: privacy
- Pain: Identify records approaching retention deadlines.
- Reusable primitive: retention monitoring

### P389 — Data exports omit important fields
- Vector: data_ops
- Pain: Validate exports against requested schema and source counts.
- Reusable primitive: export validation

### P390 — Data imports silently corrupt structure
- Vector: data_ops
- Pain: Compare source and destination counts, types and constraints.
- Reusable primitive: import reconciliation

### P391 — Spreadsheets drift from authoritative databases
- Vector: data_ops
- Pain: Detect mismatched values and identify the authoritative source.
- Reusable primitive: drift detection

### P392 — Business dashboards contain unexplained metric changes
- Vector: analytics
- Pain: Trace metric changes to source data and definition changes.
- Reusable primitive: provenance analysis

### P393 — Sales promises disappear during handoff
- Vector: sales_ops
- Pain: Extract commitments from proposals and map them to delivery.
- Reusable primitive: promise tracking

### P394 — Quotes are sent but never followed up
- Vector: sales_ops
- Pain: Track quote expiry and unanswered buyer actions.
- Reusable primitive: followup automation

### P395 — Leads have incomplete qualification data
- Vector: sales_ops
- Pain: Detect missing buying requirements before sales effort is spent.
- Reusable primitive: qualification

### P396 — Customer complaints lose commercial context
- Vector: customer_ops
- Pain: Link complaint, order, promise and remedy evidence.
- Reusable primitive: case reconciliation

### P397 — Service-level breaches are discovered after renewal
- Vector: customer_ops
- Pain: Monitor committed service metrics against actual records.
- Reusable primitive: SLA monitoring

### P398 — Recurring service work is delivered inconsistently
- Vector: customer_ops
- Pain: Compare scheduled commitments with delivery evidence.
- Reusable primitive: service verification

### P399 — Businesses lack a portable transaction history with counterparties
- Vector: trust
- Pain: Aggregate verified orders, delivery, payment and dispute evidence.
- Reusable primitive: transaction passport

### P400 — B2B transactions fragment across email, spreadsheets and payment systems
- Vector: marketplace
- Pain: Unify discovery, RFQ, offer, agreement, payment, delivery, acceptance and dispute state.
- Reusable primitive: transaction OS

## Selection law

These are problem candidates, not products or revenue. A candidate becomes a product only when the smallest repeatable transaction has an identifiable buyer, an exact input contract, a concrete output, legitimate access, a delivery surface, a payment boundary, and independent evidence.

The preferred expansion path is:

PAIN -> TRANSACTION -> PRIMITIVE -> PRODUCT WEDGE -> BUYER -> PAYMENT -> FULFILMENT -> EVIDENCE -> REPEAT -> MARKETPLACE ADJACENCY

The B2B marketplace target is the shared transaction substrate beneath these pains. The system should reuse one state machine, one evidence/provenance layer, one trust layer, one settlement boundary and one listing/RFQ/order model rather than create a separate architecture for each pain.

## Productization rule

Do not create 100 checkout products merely because 100 pains exist. Cluster pains around reusable transaction primitives. Build a new silo only when its buyer, input, output, fulfilment and payment boundary are sufficiently distinct to justify a public surface. Otherwise represent it as a capability, category, workflow or adapter inside the marketplace.

## Current economic truth

VERIFIED_EXTERNAL_REVENUE = NZ$0.00
SETTLED_EXTERNAL_PAYMENTS = 0
INDEPENDENT_EXTERNAL_BUYERS = 0
VERIFIED_ECONOMIC_OUTCOMES = 0
