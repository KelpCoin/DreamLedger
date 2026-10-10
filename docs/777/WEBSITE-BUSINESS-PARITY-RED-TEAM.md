# DreamLedger Website-to-Business Parity Red-Team and Recovery Backlog
**Date:** 2026-10-10
**Status:** LIVE-PAGE OBSERVATIONS + DESIGN AUDIT; runtime, payment, and fulfillment claims remain UNVERIFIED unless explicitly observed.
**Purpose:** Preserve refined BrownEye/DreamLedger IP and turn it into an evidence-backed repair queue rather than leaving it stranded in conversation history.
**Core method:** BrownEye Tri-Fecta = positive signal + negative signal + triangulated ruling. The ruling is not an average. It is what survives adversarial review against provenance, buyer value, safety, delivery burden and evidence.
**Scope guard:** No new bridge, queue, ledger, paid provider, replacement SKU or spend. Reuse the existing DreamLedger substrate and connected tools. Never infer settled revenue from a page, code, checkout start, internal row or test.

## Live inspection summary
- Homepage: https://dreamledger.org/ presents evidence-first commerce, a free supplier worksheet and free Truth Oracle. Clear trust posture; paid, repeatable outcome is less prominent than the methodology.
- Supplier comparison: https://dreamledger.org/quote-comparison/ explicitly says the paid automated flow is unavailable while payment verification and report delivery are repaired. Treat paid flow as PAUSED.
- Truth Oracle: https://dreamledger.org/truth-oracle.html says its feed contains leads, not verified truths; the inspected render showed “Loading public records…”. Methodology is promising; feed behavior and source graph need verification.
- Trust standard: https://dreamledger.org/trust/ clearly rejects unsupported customer, availability, independence, certification and uptime claims.
- Guide: https://dreamledger.org/truth-oracle-field-guide.html gives useful five-step source checks.
- https://dreamledger.org/commander-diagnostic/ returned 404 during this inspection.
- https://dreamledger.org/agentic-commerce-remediation-blueprint/ returned 404 during this inspection.
- https://dreamledger.org/catalogue/ presents itself as an older catalogue and links to https://dreamledger.org/marketplace.html. Inspect current marketplace page before claiming the catalogue is functional.
- These are fetched-page observations, not a full browser, Stripe, webhook, or end-to-end fulfillment test.

## Global Tri-Fecta rules
1. **Positive:** steelman value, buyer job, reusable leverage, revenue potential and strongest supporting evidence.
2. **Negative:** seek disconfirming evidence, failure modes, source conflicts, cost, legal/IP risk, operator burden and ways the promise could be false.
3. **Triangulated:** state what survives, what is unknown, the smallest safe experiment, proof needed, and whether the action can be promoted.
4. Source count is not source independence. Reposts, syndicated coverage, affiliate pages and articles citing the same press release are one evidence root until shown otherwise.
5. The source asserting a claim cannot independently certify that same claim. Keep company-reported, vendor-reported, model-inferred and independently verified evidence separate.
6. Unknown is not pass. A high-confidence model response is not evidence. Contradiction is retained, not averaged away.
7. A paid offer passes only when promise → canonical offer → checkout → settled payment → correct entitlement → delivery → receipt → reconciliation all work.

## Severity and sequencing
- **P0:** trust or revenue boundary that can mislead buyers or block paid delivery.
- **P1:** broken discovery/navigation or capability parity.
- **P2:** quality improvements that must not delay restoring a proven route.
- Repair in this order: Truth Oracle provenance/availability truth; exact live offer inventory; one existing first-dollar path; checkout-to-fulfillment evidence; only then broaden the catalogue.
- Existing protocol: https://github.com/KelpCoin/DreamLedger/blob/main/docs/777/CONNECTOR-FIGURE-EIGHT-OPERATING-PROTOCOL.md
- Pattern Foundry: https://github.com/KelpCoin/DreamLedger/blob/main/docs/777/PATTERN-FOUNDRY.md
- Pattern Overlay: https://github.com/KelpCoin/DreamLedger/blob/main/docs/777/PATTERN-OVERLAY-AUDIT.md


## B1 — Paid offer availability and checkout-to-fulfilment mismatch
**Severity:** P0 / revenue-critical

**Observed blocker:** The live /quote-comparison/ page explicitly says paid automated comparison is unavailable while payment verification and report delivery are repaired. Do not sell or advertise this paid flow as available until the real path is proven.

**Positive signal:** The public page honestly quarantines the unavailable paid flow and preserves a free worksheet. This is better than misleading buyers.

**Negative signal:** The wider offer catalogue and previous commercial plans can still imply paid readiness; checkout, payment verification, intake, report generation, delivery, and receipt have not been proven together.

**Triangulated ruling:** Keep the paid route unavailable until a complete test and independent end-to-end proof pass. Preserve the free worksheet as the live fallback. Reconcile catalog, CTA, Stripe state, webhook, fulfillment and customer-facing copy against one canonical offer record.

### 50 materially distinct solution paths
1. Keep the paid CTA disabled and the free worksheet primary until the whole path passes.
2. Show an explicit status banner with last-checked timestamp and scope.
3. Add a single canonical offer manifest consumed by website and checkout.
4. Make public price, currency, product ID and Stripe Price ID derive from the same manifest.
5. Verify the exact Payment Link is active before enabling any paid CTA.
6. Verify its line item amount and currency against the offer manifest.
7. Verify redirect target after checkout without initiating a charge.
8. Verify intake captures a Checkout Session ID and exact offer ID.
9. Require a paid, settled provider status before work enters fulfillment.
10. Verify signed webhook delivery and registered event types.
11. Add an idempotent transactional inbox for webhook events.
12. Persist event IDs and reject duplicate processing.
13. Reject missing or unknown SKU metadata instead of defaulting.
14. Bind checkout session, offer, buyer, and fulfillment request together.
15. Make unpaid and expired sessions ineligible for fulfillment.
16. Reject amount, currency, or product mismatches.
17. Make report delivery produce a stable artifact ID and checksum.
18. Record a delivery receipt tied to the paid order.
19. Make the customer see delivery status and next steps.
20. Create a support-safe failure state that never says delivered prematurely.
21. Add a reconciliation job comparing Stripe, order, entitlement, and delivery.
22. Test replaying the same webhook three times.
23. Test out-of-order webhook arrival.
24. Test provider timeout after a successful event.
25. Test fulfillment succeeds but receipt write fails.
26. Test receipt succeeds but delivery fails.
27. Test refund and dispute status against entitlement.
28. Test zero-byte, malformed, and missing customer uploads.
29. Test source URL access errors and unsupported file formats.
30. Publish an exact scope and exclusions list for the paid output.
31. State delivery time only after measuring actual delivery latency.
32. Offer a manual bounded fulfillment fallback only if capacity and proof are real.
33. Keep the free worksheet fully functional without account creation.
34. Capture privacy notice and retention period at upload intake.
35. Do not collect contact details unless needed for delivery.
36. Add a pre-purchase preview with a sample output marked illustrative.
37. Add an acceptance checklist visible before payment.
38. Keep refund terms adjacent to the paid CTA.
39. Add a synthetic end-to-end test environment that cannot count as revenue.
40. Label test orders TEST and exclude them from economic metrics.
41. Run a production smoke test against the deployed public route after every release.
42. Add a route-level kill switch that disables checkout if dependencies fail.
43. Show the customer a non-payment alternative while disabled.
44. Track CTA click, checkout open, settlement, fulfillment and delivery as distinct events.
45. Require source-to-order attribution to be non-empty before marking a sale verified.
46. Reconcile net payment after fees, refunds, and chargebacks.
47. Add a documented recovery path for ambiguous Stripe responses.
48. Keep an immutable incident record for any misrouted or unfulfilled payment.
49. Only re-enable the offer after Gauntlet G0–G10 evidence is attached.
50. Promote the route only after an independent buyer pays and receives the promised result.

**Gauntlet evidence required:** Exact active Stripe product/price and redirect, webhook registration/signature, order/SKU attribution, paid-state check, entitlement, successful output, delivery receipt, replay tests, reconciliation, independent buyer.

## B2 — Product discovery and URL integrity
**Severity:** P1 / trust and conversion

**Observed blocker:** The exact paths /commander-diagnostic/ and /agentic-commerce-remediation-blueprint/ returned 404. They may have moved, but these destinations are not currently usable as inspected.

**Positive signal:** The about page lists existing tools and product areas, and the website has a small, consistent evidence-first identity.

**Negative signal:** If catalogue entries, links, social previews, or automation prompts refer to these dead paths, a visitor may hit a dead end or be unable to understand what is actually for sale.

**Triangulated ruling:** Inventory every public and internal offer reference, map each to one canonical live page, and quarantine offers without an end-to-end fulfillment contract. Avoid creating substitute SKUs just to make broken links appear fixed.

### 50 materially distinct solution paths
1. Search repository and deployed pages for every occurrence of both broken paths.
2. Inspect the current marketplace.html and shop.html destinations.
3. Create a canonical route inventory with status and owner.
4. Map old paths to verified replacements only after checking the replacement content.
5. Use permanent redirects only when the replacement is semantically equivalent.
6. Return a branded 404 page with working navigation and a search/contact route.
7. Remove dead CTA links from the homepage.
8. Remove dead URLs from sitemap.xml.
9. Update canonical metadata on replacement pages.
10. Check internal links in about, trust, marketplace and shop pages.
11. Check mobile navigation links separately.
12. Check Open Graph title and URL for each live product page.
13. Check robots and canonical tags for stale duplicate pages.
14. Add automated link checking to CI.
15. Add a production URL smoke test after deploy.
16. Build a route manifest from actual files and explicit redirects.
17. Require each paid offer to include a public page URL in the canonical catalog.
18. Reject catalog offers whose canonical URL returns non-2xx.
19. Mark unavailable offers as QUARANTINE rather than hiding the failure.
20. Keep redirects out of checkout until redirect destination is verified.
21. Test query-string preservation through redirects.
22. Test trailing-slash and .html variants.
23. Test uppercase/lowercase path behavior.
24. Test unknown routes on mobile Safari.
25. Test cached 404 behavior after a fix.
26. Set cache invalidation rules for corrected routes.
27. Use a stable offer ID separate from the page slug.
28. Keep price and product scope out of the URL slug.
29. Generate sitemap only from approved public pages.
30. Add a dead-link report to the daily audit.
31. Create a public product index showing available, free, paused and retired states.
32. Show why an offer is paused without promising a repair date.
33. Ensure a 404 does not fall back to a different paid offer.
34. Do not reuse an unrelated Payment Link as a redirect target.
35. Preserve retired-page history for internal attribution.
36. Add a migration map for changed URLs.
37. Check external backlinks to dead paths before retiring them.
38. Update GitHub issues and Notion pages that contain old URLs.
39. Update scheduled tasks to treat legacy URLs as leads, not ground truth.
40. Validate links from search engine snippets where observable.
41. Validate links from social cards and QR codes.
42. Use exact page titles matching the offer a user expects.
43. Make the destination explain who the product is for.
44. Make the destination state inputs, outputs, limits and delivery mode.
45. Add a single CTA only when its action is real and safe.
46. Do not put a price on a page if the payment route is unavailable.
47. Add route tests for all offers before promotion.
48. Have Gauntlet fail if a promoted offer URL is missing or broken.
49. Recheck all route status codes after each public deployment.
50. Record a dated evidence snapshot for each audited URL.

**Gauntlet evidence required:** Every referenced URL resolves to the intended live content; route manifest, internal link scan, sitemap, metadata and production smoke tests agree.

## B3 — Truth Oracle source legitimacy and feed readiness
**Severity:** P0 / trust-critical

**Observed blocker:** The Truth Oracle page gives strong guidance on original sources, dates, scope, contradictions, and uncertainty, but the inspected live page displayed “Loading public records…”. It explicitly calls the feed leads rather than verified truths. The missing step is a demonstrably operating source-verification workflow and clear visible behavior when data is unavailable.

**Positive signal:** The methodology already discourages source-link laundering, stale claims, unsupported certainty, and treating a listing as a sale. The page says paid products cannot buy a better truth verdict.

**Negative signal:** A source link is not independence; several articles repeating one press release are not multiple sources. The visitor needs to see provenance, source class, corroboration relationships, counterevidence, freshness, and why the ruling follows.

**Triangulated ruling:** Operationalize the BrownEye Tri-Fecta as a source-evidence graph: positive evidence, negative/counterevidence, and a triangulated ruling. Independence must be measured by underlying origin and incentives, not URL count. No source should certify its own claim.

### 50 materially distinct solution paths
1. Define a versioned claim schema with exact wording and decision scope.
2. Store the original source URL, canonical URL and retrieval timestamp.
3. Store publication date separately from observation/retrieval date.
4. Capture the exact passage or data row that supports each claim.
5. Record the source author, publisher and responsible organization where known.
6. Classify sources as primary, official secondary, independent secondary, advocacy, anonymous, or unknown.
7. Record source incentives and commercial relationships.
8. Track ownership and common control across sources.
9. Cluster syndicated stories by their underlying press release or data source.
10. Count independent evidence roots, not raw URLs.
11. Separate source authority from source independence.
12. Separate recency from reliability.
13. Track version, geography, market, cohort and time period for every claim.
14. Record claim polarity: supports, contradicts, contextualizes, or does not address.
15. Require a negative-evidence search for high-impact claims.
16. Require a positive-evidence search rather than relying on absence of contradictions.
17. Use the Tri-Fecta: positive steelman, negative steelman, triangulated ruling.
18. Do not average positive and negative signals into a false neutral.
19. Require the ruling to cite evidence on both sides where available.
20. Permit INSUFFICIENT EVIDENCE when one side cannot be responsibly tested.
21. Use confidence labels tied to explicit criteria rather than model intuition.
22. Keep fact, source statement, inference, forecast and opinion in separate fields.
23. Track corrections and retractions as first-class source events.
24. Re-fetch sources before a time-sensitive claim is promoted.
25. Apply domain-specific freshness windows.
26. Show when a source is inaccessible, paywalled, deleted or robots-blocked.
27. Never treat inaccessible content as evidence for the claim.
28. Store a content hash for the retrieved snapshot, alongside the URL.
29. Store extraction method and parser version.
30. Keep quote spans short and retain a pointer to the original context.
31. Detect when a quoted passage omits a qualifying sentence.
32. Record counterexamples and exclusion clauses.
33. Check official documentation before relying on summaries for platform behavior.
34. Check legal or medical claims against authoritative sources and state limits.
35. Never turn a supplier's own performance claim into independent verification.
36. Label company-reported results as company-reported.
37. Distinguish transaction evidence from demand claims and customer testimonials.
38. Separate the evidence graph from the generated prose summary.
39. Require a human review for high-consequence conclusions.
40. Run an adversarial reviewer tasked to disprove the strongest positive claim.
41. Run a second reviewer tasked to find the strongest supportable version.
42. Resolve reviewer disagreements by evidence, not majority vote.
43. Show unresolved disagreement and missing evidence publicly.
44. Prevent model-generated citations that were not actually retrieved.
45. Test every displayed citation opens the cited source.
46. Make an empty feed say the feed is unavailable or has no records, never imply no events exist.
47. Add a last successful refresh timestamp and health status.
48. Use a static, usable fallback template if the dynamic feed fails.
49. Provide an evidence export containing claim, sources, contradiction map and ruling.
50. Require Gauntlet to pass provenance, independence, counterevidence and freshness checks before publication.

**Gauntlet evidence required:** Source snapshots, retrieval timestamps, evidence passages, provenance roots, independence clusters, positive and negative search traces, ruling rationale, and a tested unavailable-feed state.

## B4 — Product promise, capability and fulfillment parity
**Severity:** P0 / portfolio-wide

**Observed blocker:** The public brand promises practical tools and evidence-linked outcomes. Existing project doctrine also names paid diagnostics, agent bridge calls, quote comparison, a marketplace, and remediation blueprints, but the inspected pages do not establish that every listed offer can currently be purchased, fulfilled and evidenced. The known Supabase data-plane outage makes database-dependent entitlements and delivery especially unsafe to assume.

**Positive signal:** The website already uses cautious language and a clear trust standard; the repository has a connector protocol and Pattern Foundry/Overlay specifications that can govern the portfolio.

**Negative signal:** Public presentation can drift away from real implementation. A code artifact, catalogue row, green dashboard, payment link, or successful connector write is not proof that the customer got the promised result.

**Triangulated ruling:** Create one offer-to-fulfillment registry and score each product across promise, deployed surface, price, intake, authority, dependencies, delivery, receipt, support, refund and evidence. Only sell routes that pass every applicable hard gate; keep free tools available when they work independently.

### 50 materially distinct solution paths
1. Create one canonical offer registry with stable IDs.
2. Assign each offer a lifecycle status: DRAFT, TEST, AVAILABLE, PAUSED, QUARANTINE or RETIRED.
3. Store the canonical URL, Stripe Price ID, currency, scope and fulfillment contract together.
4. Record each offer's actual input requirements.
5. Record the output artifact type and acceptance criteria.
6. Record whether fulfillment is automated, manual or mixed.
7. Name the true runtime dependencies for each offer.
8. Mark Supabase-dependent functions unavailable while the data plane is down.
9. Do not substitute in-memory state for durable entitlements without explicit redesign and disclosure.
10. Add a dependency health gate before checkout.
11. Add a manual fulfilment fallback only for work the operator can actually deliver.
12. Estimate delivery time from observed runs rather than aspiration.
13. Publish limitations and exclusions beside the CTA.
14. Use a sample deliverable that is clearly marked as an example.
15. Add a pre-purchase checklist so buyers know what to supply.
16. Define how a buyer submits source material securely.
17. Define retention and deletion for uploaded material.
18. Create a delivery receipt schema tied to order ID.
19. Require a customer-visible artifact or result for fulfilment completion.
20. Add an evidence link to every completed order.
21. Reconcile payment, offer ID, order ID and artifact ID.
22. Make missing artifacts visible as UNFULFILLED.
23. Make partial delivery visible as PARTIAL, not complete.
24. Create a customer-safe recovery path for delivery failures.
25. Define refund handling for non-delivery and misdescription.
26. Track support burden per offer.
27. Track human minutes per verified delivery.
28. Track gross receipts separately from net contribution.
29. Track refunds and disputes separately from gross sales.
30. Track repeat use only for independent customers.
31. Keep test and internal events out of public success metrics.
32. Create a production acceptance test for each offer.
33. Run the tests against the deployed public URL, not only local code.
34. Require independent review for security-sensitive or high-consequence products.
35. Audit public claims for certifications, guarantees, case studies and uptime promises.
36. Remove claims without proof or relabel them as intended capability.
37. Add an expiry date to availability evidence.
38. Recheck the exact Stripe product and price before re-enabling an offer.
39. Ensure unknown SKU never maps to a fallback product.
40. Ensure paid entitlement is scoped to the purchased resource.
41. Ensure duplicate webhooks cannot duplicate delivery.
42. Ensure refund/reversal affects entitlement appropriately.
43. Make outages fail closed for paid access when authorization cannot be verified.
44. Add monitoring for checkout, webhook, order, delivery and receipt boundaries.
45. Create a portfolio-level parity report from actual sources.
46. Make the homepage CTA point to the strongest working free or paid experience.
47. Keep one primary CTA per silo and avoid competing toll roads.
48. Quarantine overlapping offers until their buyer and outcome differ clearly.
49. Require Gauntlet G0–G10 before promoting an offer.
50. Require one independent buyer, settled payment and verified delivery before calling a paid path proven.

**Gauntlet evidence required:** One canonical offer registry maps the public promise to dependencies, payment, intake, output, delivery evidence, refunds and support; deployed tests pass.

## Initial acceptance checklist
- [ ] Audit every public offer URL, not just the first five.
- [ ] Locate all legacy offer references in repository, Notion, scheduled task prompts and catalogue.
- [ ] Resolve the canonical first-dollar conflict: do not run QUOTE-COMPARE-49 and TOLL-PROBE-50C as competing “first” routes; choose one based on actual deployed path and dependencies.
- [ ] Recheck the existing TOLL-PROBE-50C endpoint and manifest without initiating a purchase.
- [ ] Confirm the current Supabase data-plane status before assuming durable entitlements or DB-backed fulfillment.
- [ ] Publish the Tri-Fecta claim/evidence schema and deterministic source-independence rules.
- [ ] Do not count a test, self-purchase, unmatched payment, payment link, checkout session, or generated artifact as revenue.
- [ ] Keep verified external revenue at NZ$0.00 unless independent settlement and completed fulfillment are both evidenced.

## Scope note
This document contains solution candidates, not 200 verified fixes. Select the smallest safe repair after evidence collection; avoid implementing multiple alternatives at once. Every implementation needs a test, external verification where relevant, and a dated evidence receipt.

## B5 — Product catalogue/feed loading and duplicated generic signals
**Severity:** P1 / discovery and source quality

**Observed blocker:** The live `/shop.html` page showed “Loading listed products…”. The `/pulse/` page contained repeated generic “UNVERIFIED market signal” entries with no visible unique claim detail in the extracted page text. The current marketplace correctly says third-party listings are temporarily unavailable. These states may be client-side or extraction limitations, so the next step is to test in a browser and inspect the data endpoint, not assume a backend failure.

**Positive signal:** The marketplace discloses that community listings are paused while seller identity and availability checks improve. Pulse notes repeatedly warn that research leads are not demand proof.

**Negative signal:** Indefinite loading and repetitive generic records make the catalogue look empty or placeholder-driven, reduce buyer confidence, and obscure which products genuinely exist and work.

**Triangulated ruling:** Verify actual browser rendering and the data source. If records are unavailable, show a clear unavailable/empty state rather than loading forever or repeating generic records. Every displayed item must be unique, source-linked, dated and correctly classified.

### 50 materially distinct solution paths
1. Make the product list render a useful server-side fallback when JavaScript fails.
2. Expose the catalogue data endpoint health and last successful fetch timestamp.
3. Replace indefinite loading text with a timed unavailable state.
4. Provide a direct link from every loading card to its canonical product page.
5. Make empty, unavailable, stale and successfully empty datasets distinct states.
6. Return a machine-readable schema version with catalogue data.
7. Validate each listing against required title, price, currency, URL and status fields.
8. Reject listings without a canonical offer ID.
9. Reject paid listings whose checkout URL is missing.
10. Reject paid listings whose checkout has not been revalidated.
11. Show availability status and last-checked time for each offer.
12. Never render UNVERIFIED market signals as confirmed demand.
13. Replace repeated generic market-signal placeholders with actual source-linked records or an honest empty state.
14. Deduplicate feed entries by stable source/event ID.
15. Group syndicated sources under their underlying origin.
16. Show source date and observed date separately.
17. Show a direct source link and a short supporting passage.
18. Label research notes as research, not validated customer demand.
19. Separate editorial content from product inventory in the data model.
20. Keep product records out of the market-signal feed unless they are explicitly classified.
21. Add pagination with stable cursors rather than duplicating the same records.
22. Add a maximum feed size and deterministic ordering.
23. Make ordering stable when timestamps are equal.
24. Use stale-while-revalidate only with a visible stale badge.
25. Set an explicit data freshness policy per feed type.
26. Add schema and contract tests for feed payloads.
27. Add a no-JavaScript smoke test for product discovery.
28. Add a mobile Safari test for list loading and CTA usability.
29. Add a timeout and retry cap for the public feed request.
30. Use a circuit breaker after repeated upstream failures.
31. Keep retry failures out of the public result set.
32. Log a safe diagnostic ID for failed feed loads without exposing secrets.
33. Add content-security policy and safe output escaping for feed fields.
34. Validate URLs to prevent javascript: and unsafe schemes.
35. Sanitize untrusted source titles and snippets before rendering.
36. Ensure external source links open safely and preserve the real destination.
37. Provide a downloadable JSON/CSV export only when the records have validated schema.
38. Show the number of actual validated records rather than placeholder counts.
39. Do not show fabricated examples in the live feed.
40. Mark synthetic examples visibly as TEST or EXAMPLE.
41. Make every research card state its evidence grade.
42. Show why a record is included and what decision it informs.
43. Connect research cards to claim IDs and evidence graphs.
44. Ensure each listed paid product has an acceptance contract.
45. Hide unavailable offers from buy-ready filters but retain them in a status view.
46. Run a link checker over every feed card destination.
47. Run a production smoke test for /shop.html, /marketplace.html and /pulse/ after deploy.
48. Compare the source data with the public rendered output.
49. Add a stale-feed alert to the existing audit, without adding a new paid monitoring service.
50. Promote the feed only after duplicate, stale, missing-source and unavailable-state tests pass.

**Gauntlet evidence required:** Browser-rendered evidence, endpoint response/schema, unique stable record IDs, source/date fields, truthful empty/error states, route checks, and parity between source data and visible cards.
