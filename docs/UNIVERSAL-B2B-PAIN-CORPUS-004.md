# Universal B2B Pain Corpus 004

Date: 2026-09-29

Purpose: expand DreamLedger from isolated toll booths into a reusable B2B transaction marketplace substrate. These are hypotheses, not revenue or validated demand.

## 100 pain candidates

| # | Vector | Everyday/B2B pain | Reusable primitive | Product surface |
|---:|---|---|---|---|
| 1 | Money | Find unexpected charges | anomaly detection | billing |
| 2 | Money | Match invoices to payments | reconciliation | finance |
| 3 | Money | Find duplicate invoices | duplicate detection | AP |
| 4 | Money | Recover missed supplier credits | credit reconciliation | procurement |
| 5 | Money | Explain bank-fee changes | fee analysis | finance |
| 6 | Money | Forecast late invoices | payment-risk prediction | AR |
| 7 | Money | Find unused subscriptions | spend audit | finance |
| 8 | Money | Check quote completeness | scope comparison | procurement |
| 9 | Money | Compare supplier quotes | quote normalization | procurement |
| 10 | Money | Calculate landed cost | total-cost calculation | procurement |
| 11 | Money | Track supplier price increases | price monitoring | procurement |
| 12 | Money | Prepare accountant handoff packs | evidence assembly | accounting |
| 13 | Money | Assemble GST evidence | tax evidence | tax |
| 14 | Money | Find missing tax invoices | document reconciliation | tax |
| 15 | Money | Build audit-ready expense evidence | audit packaging | accounting |
| 16 | Money | Reconcile card spend to receipts | receipt matching | finance |
| 17 | Money | Detect undercharged customers | invoice reconciliation | revenue |
| 18 | Money | Find expired discounts and credits | commercial monitoring | finance |
| 19 | Money | Compare financing offers | term normalization | treasury |
| 20 | Money | Track project cost overruns | budget reconciliation | operations |
| 21 | Documents | Turn emailed PDFs into structured records | document extraction | back office |
| 22 | Documents | Find latest document version | version control | operations |
| 23 | Documents | Find missing attachments | document completeness | operations |
| 24 | Documents | Compare signed contracts with drafts | document diff | legal |
| 25 | Documents | Extract contract renewal dates | obligation extraction | legal |
| 26 | Documents | Find every contract clause mention | semantic search | legal |
| 27 | Documents | Turn forms into structured records | form ingestion | admin |
| 28 | Documents | Redact sensitive information | redaction | privacy |
| 29 | Documents | Prove when a document existed | timestamped evidence | legal |
| 30 | Documents | Package documents with provenance | evidence packet | audit |
| 31 | Documents | Convert spreadsheets into clean datasets | schema normalization | operations |
| 32 | Documents | Extract receipt data | OCR extraction | finance |
| 33 | Documents | Classify incoming documents | document classification | back office |
| 34 | Documents | Detect inconsistent figures across reports | cross-document reconciliation | finance |
| 35 | Documents | Summarize supplier contracts | document summarization | procurement |
| 36 | Trust | Verify a supplier is a real business | KYB | procurement |
| 37 | Trust | Check supplier licence currency | credential verification | procurement |
| 38 | Trust | Verify insurance certificates | credential verification | procurement |
| 39 | Trust | Verify business bank details | account verification | finance |
| 40 | Trust | Check counterparty sanctions exposure | sanctions screening | compliance |
| 41 | Trust | Find beneficial ownership | ownership resolution | compliance |
| 42 | Trust | Check contractor credentials | credential verification | operations |
| 43 | Trust | Preserve supplier verification evidence | provenance | procurement |
| 44 | Trust | Detect suspicious supplier-detail changes | change monitoring | finance |
| 45 | Trust | Verify buyer purchase authority | buyer verification | marketplace |
| 46 | Trust | Build portable supplier trust records | reputation passport | marketplace |
| 47 | Trust | Verify customer business information | KYB | sales |
| 48 | Trust | Detect stale compliance certificates | freshness monitoring | compliance |
| 49 | Trust | Assemble due-diligence evidence | evidence assembly | finance |
| 50 | Trust | Resolve aliases for one legal entity | entity resolution | data |
| 51 | Work | Turn vague purchase requests into RFQs | requirement extraction | procurement |
| 52 | Work | Collect comparable supplier responses | RFQ workflow | procurement |
| 53 | Work | Chase unanswered quotes | workflow automation | procurement |
| 54 | Work | Track quote expiry | deadline monitoring | procurement |
| 55 | Work | Route purchases for approval | approval workflow | finance |
| 56 | Work | Prove who approved a purchase | approval evidence | audit |
| 57 | Work | Track supplier delivery commitments | obligation monitoring | operations |
| 58 | Work | Check delivered goods against orders | acceptance reconciliation | logistics |
| 59 | Work | Handle partial deliveries | exception workflow | logistics |
| 60 | Work | Track damaged-goods claims | claim workflow | operations |
| 61 | Work | Build supplier dispute timelines | dispute evidence | procurement |
| 62 | Work | Compare repair estimates | quote normalization | facilities |
| 63 | Work | Match technicians to equipment | capability matching | maintenance |
| 64 | Work | Track maintenance due dates | maintenance monitoring | facilities |
| 65 | Work | Find warranties before expiry | warranty monitoring | assets |
| 66 | Work | Find proof of purchase for claims | evidence retrieval | assets |
| 67 | Work | Coordinate recurring supplier orders | repeat procurement | operations |
| 68 | Work | Compare freight offers | quote comparison | logistics |
| 69 | Work | Track shipment exceptions | delivery monitoring | logistics |
| 70 | Work | Match delivery notes to POs | document matching | warehouse |
| 71 | People | Onboard suppliers without missing paperwork | onboarding workflow | procurement |
| 72 | People | Provision employee business access | access workflow | HR |
| 73 | People | Offboard contractors safely | access revocation | security |
| 74 | People | Collect customer-required documents | document collection | sales |
| 75 | People | Check applications for completeness | completeness verification | operations |
| 76 | People | Track who owes an approval | workflow monitoring | operations |
| 77 | People | Prepare meeting packs from scattered records | information assembly | management |
| 78 | People | Turn decisions into tracked obligations | action extraction | operations |
| 79 | People | Find unresolved customer complaints | exception search | support |
| 80 | People | Build customer-service evidence trails | case evidence | support |
| 81 | Property | Compare building maintenance quotes | quote normalization | property |
| 82 | Property | Track property maintenance obligations | obligation monitoring | property |
| 83 | Property | Collect contractor insurance | verification | property |
| 84 | Property | Compare property service contracts | contract comparison | property |
| 85 | Property | Track inspection expiry | compliance monitoring | property |
| 86 | Property | Assemble repair evidence for insurers | claim evidence | property |
| 87 | Property | Compare utilities and renewals | renewal comparison | property |
| 88 | Property | Track equipment across sites | asset registry | facilities |
| 89 | Commerce | Create listings from structured inventory | listing generation | marketplace |
| 90 | Commerce | Synchronize inventory across channels | inventory synchronization | marketplace |
| 91 | Commerce | Normalize supplier catalogues | catalog normalization | marketplace |
| 92 | Commerce | Match buyer requirements to inventory | buyer-supplier matching | marketplace |
| 93 | Commerce | Compare seller offers side by side | offer comparison | marketplace |
| 94 | Commerce | Verify seller business identity | seller verification | marketplace |
| 95 | Commerce | Collect and reconcile orders | order reconciliation | marketplace |
| 96 | Commerce | Capture delivery acceptance | transaction acceptance | marketplace |
| 97 | Commerce | Resolve disputes from evidence | dispute workflow | marketplace |
| 98 | Commerce | Create repeat-order templates | repeat procurement | marketplace |
| 99 | Commerce | Reconcile marketplace fees and payouts | settlement reconciliation | marketplace |
| 100 | People | Detect missing onboarding steps across a team | completeness monitoring | operations |

## Product factory

Every candidate uses the same production grammar:

DEMAND -> REQUIREMENT -> RFQ/OFFER -> TRUST -> AGREEMENT -> PAYMENT -> FULFILMENT -> ACCEPTANCE -> EVIDENCE -> REPEAT.

A candidate is promoted through:

HYPOTHESIS -> SANDBOXED -> FULFILLABLE -> OFFER_LIVE -> DEMAND_OBSERVED -> TRANSACTING -> VERIFIED.

Sandbox data is TEST/SIMULATED. It never changes economic truth.

## Trade Me competitor direction

Build the B2B transaction layer around the listing rather than cloning consumer classifieds:

1. Business identity and seller verification.
2. Structured catalogue/listing.
3. Buyer requirement/RFQ.
4. Supplier discovery and capability matching.
5. Quote normalization and side-by-side comparison.
6. Approval and negotiation.
7. Payment/settlement.
8. Delivery and acceptance.
9. Evidence/dispute record.
10. Repeat purchasing and supplier history.

The existing 300 transaction primitives and 600-problem map become the reusable substrate. MTG remains a sandbox only. Production commerce state remains isolated.

## Operating constraint

Do not create acquisition demand for a product whose promised outcome has no legitimate fulfilment route. Conversely, do not build speculative full automation for every hypothesis. First establish a concrete fulfilment contract and a sandbox fixture; then expose a real offer; then measure external demand; then automate the proven bottleneck.

## Economic truth

VERIFIED_EXTERNAL_REVENUE = NZ$0.00
SETTLED_EXTERNAL_PAYMENTS = 0
INDEPENDENT_EXTERNAL_BUYERS = 0
VERIFIED_ECONOMIC_OUTCOMES = 0

None of the above changes merely because this corpus, a product, a listing, a checkout, an agent run or a CI deployment exists.
