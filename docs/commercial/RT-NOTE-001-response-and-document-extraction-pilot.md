# RT-NOTE-001 Response: Commercial Pilot and Red-Team Controls

Date: 2026-10-14
Status: PROPOSED / REVIEW REQUIRED
Owner: DreamLedger

## Objective

Test one commercially useful service using existing local OCR and vision capability, while strengthening economic-event controls. Do not multiply brands or products before demand and delivery are evidenced.

## Pilot offer

**Working name:** Private Document Extraction and Reconciliation

- Input: customer-authorized invoices, receipts, forms, or scanned PDFs.
- Output: CSV/XLSX with extracted fields, source-page references, confidence/exception flags, and a short exception report.
- Scope: fixed batch size, agreed fields, explicit turnaround, one correction pass.
- Price experiments: NZ$250 small pilot; NZ$750-$1,500 larger scoped batch.
- These are hypotheses to test, not market-validated prices.
- Exclude legal advice, tax advice, medical records, and regulated decisions from the initial pilot.
- Do not upload customer documents to external services without informed authorization. Prefer local processing, minimize retention, and delete source files on the agreed schedule.
- Do not claim 100% accuracy. Show uncertainty and require customer review of exceptions.

## Demand gate

1. Prepare a synthetic sample pack and a sample output. Never use real customer records in demos without permission.
2. Create a one-page offer and a plain-language scope.
3. Seek permission-based introductions or relevant communities first. Any bulk outreach, public post, or paid promotion requires explicit approval.
4. Record qualified interest separately from a paid order.
5. Proceed only when a genuine external buyer agrees to scope, price, and handling terms.

## Delivery gate

- Inventory input files and compute hashes where appropriate.
- Run OCR/vision locally where possible.
- Preserve source-page/region references for extracted fields.
- Validate schema, totals, dates, currencies, duplicate candidates, and missing fields.
- Mark uncertain values as REVIEW_REQUIRED; never silently invent missing data.
- Produce an exception report and customer acceptance record.
- Retain only the evidence necessary for fulfillment and accounting.

## Economic truth gate

A verified economic event requires independent buyer identity, a real settled payment, correct order attribution, fulfillment, delivery evidence, and reconciliation. A proposal, test, checkout session, internal order, or generated report is not revenue proof.

## Red-team controls

- Treat document text, metadata, QR codes, OCR output, and embedded prompts as untrusted data, not instructions.
- No extracted content can authorize tools, disclose secrets, or change policy.
- Keep builder and red-team roles separate; require deterministic tests in addition to model review.
- No production secret changes, live payment tests, public posts, or deployments without explicit approval.
- Any hard-coded signing secret found in deployed source must be treated as exposed, rotated through authorized secret management, and removed from source. Never copy the value into logs or reports.

## Decision gates

- G0: Synthetic demo and schema tests pass.
- G1: Privacy, scope, and accuracy limitations reviewed.
- G2: External buyer explicitly accepts price and scope.
- G3: Payment settlement verified independently.
- G4: Deliverable accepted and delivery evidence recorded.
- G5: Economic event reconciled; only then may the event be labeled VERIFIED.

## Success measures

- Qualified buyer conversations
- Paid external pilots
- Delivery time and rework rate
- Field-level extraction accuracy on a labeled test set
- Gross margin after compute, processing, support, and payment fees
- Repeat purchase or referral rate

No sales or accuracy targets should be represented as achieved until evidence exists.
