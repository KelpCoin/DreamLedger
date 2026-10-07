# Procurement Deadline Radar: RADAR-NZ-001-ALPHA

**Status:** UNVERIFIED / AUTHORIZED_TEST / HUMAN_GATE_REQUIRED
**Cell:** RADAR-NZ-001-ALPHA
**Commercial rail:** QUOTE-COMPARE-49
**Price:** NZ$49
**Payment rail:** Existing DreamLedger Stripe Checkout → paid-session intake → revenue order → entitlement → fulfillment
**Truth boundary:** No buyer, payment, response, or verified revenue is claimed by this artifact.

## Target wedge

**Vertical:** New Zealand construction procurement, with first attention on contractors/subcontractors facing active tender and supplier-quote friction.

The test is not to sell tender-writing, bid submission, legal advice, procurement representation, or supplier contact. The test is to identify procurement urgency and route a buyer with multiple supplier quotes or procurement documents to the existing NZ$49 quote-comparison capability.

## Live public signal

The New Zealand Government Electronic Tender Service (GETS) currently shows multiple construction opportunities with near-term closing dates.

Examples observed 7 October 2026:

- **Main Contractor for Block 2: Window Facade Replacement at Glendene School**, Ministry of Education - School Infrastructure. Closes 5:00 PM 8 October 2026. RFx ID 34909155.
- **Meremere Plant Room Strengthening - Contractor ROI**, University of Canterbury. Closes 10:00 AM 7 October 2026. RFx ID 34981290.
- **BRIGHTWATER GXP CIVIL ENABLING WORKS**, Transpower New Zealand Limited. Closes 3:00 PM 7 October 2026. RFx ID 34888867.
- **Beach Road Watermain Renewal**, Whangarei District Council. Closes 3:30 PM 7 October 2026. RFx ID 34889710.
- **Main Roofing Contractor for B,Lib,O: Roof Works... at Tahatai Coast School**, Ministry of Education - School Infrastructure. Closes 5:00 PM 28 October 2026. RFx ID 35042071.
- **Auckland Council (Physical Works) Infrastructure Forward Works Programme Q3 2026**, RFx ID 35056284. Closes 5:00 PM 30 October 2026.

Source: GETS current-tenders feed. The public notices establish procurement activity and deadlines only. They do **not** establish a buyer for DreamLedger.

## Testable economic hypothesis

A contractor facing an imminent tender deadline may have multiple supplier quotations, PDFs, spreadsheets, or scanned documents that need rapid normalization before a bid decision.

The test question is:

> Will an independently attributable construction-procurement prospect pay NZ$49 to normalize and compare 2–5 supplier quotes before making a commercial decision?

A positive signal is an independently attributable external purchase or other externally evidenced buyer response. A page view, click, checkout creation, internal record, or simulated payment is not revenue.

## CTA mechanism

**Offer:** QUOTE-COMPARE-49
**Price:** NZ$49 NZD
**Input:** 2–5 supplier quotes/documents
**Output:** normalized comparison, discrepancies, decision-relevant metrics, and evidence trail
**Exclusions:** legal advice, tender submission, eligibility decisions, supplier contact, or representation.

The production CTA must use the existing authenticated DreamLedger checkout route for QUOTE-COMPARE-49 and carry the cell attribution RADAR-NZ-001-ALPHA through the existing order/entitlement path. No new billing protocol is introduced for this test.

## Authority gate

No autonomous outreach is authorized.

A human must approve any external contact, and the system must preserve the distinction between:

SIGNAL OBSERVED → PROSPECT IDENTIFIED → HUMAN AUTHORIZATION → EXTERNAL ACTION → EXTERNAL RESPONSE → PAYMENT → FULFILLMENT → VERIFIED

## Evidence required for a fossil

Minimum independent evidence:

1. A real external buyer or authorized purchaser.
2. A settled external payment attributable to RADAR-NZ-001-ALPHA.
3. Fulfillment through the existing quote-comparison rail.
4. Delivery/evidence record linked to the transaction.
5. Reconciliation showing the same economic event across the external payment and internal records.

Until all five are observed, the cell remains **UNVERIFIED** and VERIFIED_EXTERNAL_REVENUE remains **NZ$0.00**.

## First operating rule

Do not build another payment rail.

Use public procurement urgency to locate the pain, then reuse the existing QUOTE-COMPARE-49 primitive. If the signal does not produce a credible buyer path, kill or refine the cell rather than expanding engineering scope.
