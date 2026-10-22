# 777 private campaign admission (existing commerce silo)

Evidence status: PRIVATE CODE STAGING / NOT PUBLISHED / NO PAID DELIVERY / NO VERIFIED REVENUE.

Source spec: pasted revised "Draft-and-Approve" sales funnel, October 2026. This implementation deliberately REUSES the existing commercial events and payment system. **Do not create a new public.payments table, economic ledger, tenant factory, RSS scraper, cron or API endpoint.** Neon staging did not contain the proposed public.signals/post_drafts/funnel_events/payments tables at inspection; adding them would duplicate/fragment the current financial source of truth.

Implementation: stdlib-only `runtime/distribution/draft_campaign.py`. Accepts an owner-authorized JSON source, only the existing free quote comparison worksheet in the commerce silo, prepares a deterministic human-reviewable draft, SHA-256 digest, campaign ref and review packet. It never publishes, posts to Reddit/Discord/X, creates Stripe objects, contacts buyers or promotes economic state. The local source URL is *not independently confirmed demand*.

Existing public tool: https://dreamledger.org/quote-comparison/ (cached public content says free/local-only, no PDF upload/paid automated report). Existing Stripe `QUOTE-COMPARE-49` active link is NZD49 with a manual 24-hour delivery promise. This module **rejects** paid promotion until reliable unattended fulfillment and delivery have actually passed an independent test. Merely marking a flag or model score is not acceptance evidence.

Stripe documents `client_reference_id` as a supported Payment Link URL parameter that flows into the Checkout Session completed webhook. The pure `make_attributed_link` function constructs a candidate URL but does not post it or claim a purchase. The separate observation function requires upstream real signature verification and still returns attribution-only, never verified revenue. Actual webhook idempotency and delivery remain governed by the existing economic system.

Do not assume LM Studio port 1234, a local running PC, licensed Reddit scraping or unrestricted Reddit autoposting. External publication remains a separately authorized gate. Neon scheduled Functions are supported with scale-to-zero but NO new trigger is configured here. Background processing should not make the Windows PC a buyer-facing dependency.

Tests (stdlib only):
```
cd runtime/distribution
python -m unittest discover -s . -p 'test_draft_campaign.py' -v
```

Sample input:
```json
{"channel":"REDDIT","silo_id":"commerce","offer_id":"FREE_QUOTE_WORKSHEET","source_permission":"OWNER_ORIGINAL","source_url":"https://dreamledger.org/quote-comparison/","observed_at_utc":"2026-10-22T00:42:00+13:00","audience":"small_business"}
```
The example is a **synthetic drafting fixture** and is NOT evidence of market demand, user interaction or posting. The file's `publication` remains `HUMAN_APPROVAL_REQUIRED`.

Immediate next economic gate: independently test one paid input -> accepted signed event -> deterministic processing -> retrievable delivery -> replay/refund handling, then acquire one authorized real buyer. No production mutation was performed by this PR.

## Optional private LM Studio rewriting (2026-10-22)
The **same** canonical `draft_campaign.py` supports an opt-in local rewrite after its deterministic source and offer validation. This is not a second campaign factory.

```sh
LM_STUDIO_BASE_URL=http://127.0.0.1:1235/v1 python runtime/distribution/draft_campaign.py \
  --input candidate.json --output private_draft.json --local-model
```

Discover the actual LM Studio port and model before enabling; do not assume 1235 or 1234 is currently live. The companion `lmstudio_copy_adapter.py` is loopback-only, requests a JSON object and rejects unapproved checkout links, paid claims, cross-silo internal names and other URLs. Failures do not publish a draft, charge a user, or advance revenue truth. A source-bound deterministic draft remains available without LM Studio. `test_lmstudio_copy_adapter.py` adds five offline checks; no real local inference has been observed in the cloud session.

GitHub CI and independent buyer/paid-delivery acceptance are separate gates. Neon Function scheduling is an option, but none has been deployed by this work.
