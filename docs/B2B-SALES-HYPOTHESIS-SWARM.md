# B2B Sales Hypothesis Swarm v1

**Status:** INTERNAL CANDIDATES ONLY. None of these entries is a verified buyer, validated demand, live offer, published silo, or revenue.

**Purpose:** Seed the existing CUBE / Elohim / Gauntlet pipeline with concrete, falsifiable B2B sales hypotheses. This is a prioritization corpus, not a substitute for external demand evidence.

## Operating rule

`HYPOTHESIS → OBSERVED BUYER PROBLEM → QUALIFIED BUYER INTENT → ONE OFFER → AUTHORIZED INPUT → FULFILLMENT → DELIVERY EVIDENCE → SETTLED PAYMENT → RECONCILIATION`

Do not skip a state. Generic news, market size, page views, internal agents, generated listings, checkout starts, and RFQ drafts are not qualified buyer intent.

## Priority order

- **P1:** Buyer can submit a real input and receive an objectively checkable deliverable quickly. Test these first.
- **P2:** Commercially plausible but needs more evidence, integrations, or workflow design.
- **P3:** Longer-cycle, history-dependent, or recurring-product candidates.

## First wave: P1

| ID | Hypothesis | Buyer | Test price | Deliverable | Candidate silo |
|---|---|---|---:|---|---|
| H001 | Supplier quote normalization | SMB buyers receiving 2–10 quotes | NZ$49–149 per quote pack | Buyer submits 2–10 quotes; structured comparison delivered with provenance and unknowns | quote-compare |
| H002 | Invoice overcharge detection | SMB finance/bookkeeping teams | NZ$49–199 per batch | Compare invoice/PO/contract rows and produce exception register | invoice-audit |
| H003 | Duplicate invoice detection | Small finance teams and bookkeepers | NZ$29–99 per batch | Deduplicated exception CSV plus match rationale | invoice-audit |
| H004 | Missed supplier credits recovery pack | SMB operators and finance teams | NZ$99–299 per review | Evidence-backed claim register; no guarantee of recovery | recovery-pack |
| H005 | Freight quote landed-cost comparison | Importers, wholesalers, ecommerce operators | NZ$49–149 per lane | Normalized freight comparison and missing-data checklist | quote-compare |
| H008 | Purchase order vs invoice reconciliation | Distributors and small manufacturers | NZ$99–299 per batch | Reconciliation CSV and evidence-linked exception list | invoice-audit |
| H010 | Surplus inventory lot valuation | Retailers, distributors, liquidators | NZ$49–199 per lot | Condition-aware valuation range and listing pack; estimates clearly labeled | surplus-exchange |
| H012 | Product catalogue cleanup | Small wholesalers and ecommerce sellers | NZ$99–499 per catalogue | Clean CSV, change log and unresolved fields | catalog-cleanup |
| H018 | Marketplace seller net-margin calculator | Multi-channel sellers and small merchants | NZ$29–99 per channel/batch | Transparent margin model and leakage flags | seller-margin |
| H020 | Supplier RFQ drafting and normalization | Buyers sourcing equipment/materials/services | NZ$29–99 per RFQ | Structured RFQ with must-haves, acceptable substitutes, delivery and evaluation rubric | rfq-desk |
| H021 | RFQ-to-offer comparison board | SMBs buying from multiple suppliers | NZ$49–149 per RFQ | Offer matrix, unresolved terms and decision log | rfq-desk |
| H026 | Service-provider quote comparison | SMBs buying IT, marketing, maintenance or consulting | NZ$49–199 per comparison | Normalized comparison and negotiation questions | quote-compare |
| H028 | Business listing claim verification | SMBs evaluating marketplace listings | NZ$19–99 per report | Claim-by-claim evidence matrix, source links, freshness and unknowns | truth-oracle |
| H032 | Supplier catalogue ingestion | Wholesalers with PDFs/CSVs and inconsistent product feeds | NZ$99–499 per feed | Normalized catalogue, provenance, schema validation and error report | catalog-cleanup |

## Full candidate set

The machine-readable registry at `data/777/b2b-sales-hypotheses.v1.json` contains 36 candidates. Each entry includes buyer, job, test-price hypothesis, fulfillment contract, required demand evidence, candidate silo, next test, status, and kill rule.

## QUBE / SWARM intake contract

1. Load entries as `INTERNAL/HYPOTHESIS_UNVALIDATED`, never as live listings.
2. Deduplicate by buyer job + input type + deliverable + fulfillment contract, not just title.
3. Attach a source URL, observed-at timestamp, and source excerpt for every external signal. Keep the original source separate from the model's interpretation.
4. Promote to `QUALIFIED_BUYER_INTENT` only when a traceable external buyer has a current concrete problem and an explicit request for a solution/vendor/tool, or submits an actual RFQ with enough detail to evaluate.
5. Before `READY`, require a legitimate input path, repeatable output, acceptance criteria, delivery surface, refund/dispute handling, cost-to-serve estimate, and exact price/currency.
6. Before public publication, route one chosen offer to one canonical silo and one CTA. Do not spawn a public page for every hypothesis.
7. A successful internal run proves only that internal run. Verified revenue requires an independent buyer, settled payment, fulfilled order, delivered output, and reconciled evidence.
8. Stop rather than fabricate supplier availability, reviews, identity verification, savings, market demand, or transaction volume.

## Trade Me reverse-engineering boundary

Reverse-engineer public transaction design and buyer/supplier workflows, not protected endpoints. Use documented APIs, permitted public pages, authorized feeds, and customer-supplied evidence. No CAPTCHA/bot-protection bypass, credential replay, session impersonation, or scraping in violation of platform terms. Marketplace supply should be permissioned and attributable.

## First three experiments

1. **Quote comparison:** one buyer supplies two or more real quotes; deliver a normalized total-cost/scope-gap matrix. Test the existing NZ$49 price hypothesis only after confirming the current checkout and fulfillment path.
2. **Invoice/PO exception audit:** one buyer supplies a small authorized sample; deliver a deterministic exception CSV with source references. Price-test a fixed batch, not a vague automation promise.
3. **RFQ drafting + offer matrix:** require an actual active purchase need, create one structured RFQ, and only claim matching when supplier responses are actually received.

For each experiment, record: source, buyer role, current problem, explicit intent, price offered, authorization, input received, output delivered, buyer acceptance, settlement, refund/dispute state, cost-to-serve, and independent evidence.

## Economic scoreboard at seed time

- Hypotheses seeded: 36
- Qualified buyer intents created by this file: 0
- Independent buyers created by this file: 0
- Settled payments created by this file: 0
- Verified revenue created by this file: NZ$0.00

This file does not create a buyer or authorize external publication.