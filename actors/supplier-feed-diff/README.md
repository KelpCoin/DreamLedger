# Supplier Feed Diff and SKU Price Review

A hosted Apify Actor for comparing two **authorized CSV snapshots** before a human imports supplier changes. This is intended to be monetized through Apify pay-per-event billing, not delivered as a local-only script.

## What it does
- Matches products by SKU and reports new, removed, unchanged and changed-price rows.
- Flags duplicate SKUs for manual review instead of silently selecting a record.
- Suppresses price deltas when a SKU's currency changes.
- Suppresses percentage changes when the baseline price is zero.
- Emits a deterministic JSON result, input SHA-256 hashes, a stable comparison key and counts by status.
- Uses Python's standard library for comparison logic; the Apify SDK provides hosted execution and billing.

## What it deliberately does not do
No network fetching, scraping, proxy use, supplier portal login, Shopify/WooCommerce writes, automatic repricing, purchases, outreach or background monitoring. The user supplies both snapshots. Process only data you are authorized to use, and review flagged rows before importing changes.

## Input
Set `authorizedDataUse` to true only if you have permission to process both snapshots. Supply `baselineCsv` and `currentCsv` as CSV text. Default columns are `sku`, `price` and `currency`; each column name is configurable. Default limits are 10,000 rows and 2 MB per snapshot; hard limits are 50,000 rows and 5 MB per snapshot.

## Output
One JSON result is stored under Actor key-value key `OUTPUT` and in the default dataset. `status` is `COMPLETED` or `REVIEW_REQUIRED`. Review `duplicate_skus` and rows with `CURRENCY_CHANGED_REVIEW` before taking action.

## Payment and publication
The Actor calls Apify's `Actor.charge(event_name="feed-comparison-completed")` once after successful deterministic comparison and before publishing output. Configure the `feed-comparison-completed` event in Apify Console under Publishing/Monetization before paid/public release. Price the comparison only after a cost trial; keep platform usage charges disabled or disclose them clearly. Code does not activate platform billing and does not mean the Actor has been published or earned revenue.

Apify currently documents pay-per-event and pay-per-usage pricing; its monthly rental model was retired in October 2026. Apify documents creator proceeds as 80% of event revenue minus platform usage costs. Test with synthetic data, Apify's documented `ACTOR_TEST_PAY_PER_EVENT=true` mode, user spending limits, idempotent retries and output readback before public release. The idempotency key is not permanent global deduplication.

## Tests
Run `python -m unittest discover -s tests -v`. Tests exercise the deterministic comparison core only and do not bill.

## Release gates
1. Run unit tests and synthetic Actor tests.
2. Configure the billing event and low, cost-safe price in Apify Console.
3. Test billing limits, retry idempotency, invalid inputs, output availability and platform usage cost.
4. Review licence, terms, privacy and retention; use limited Actor permissions.
5. Publish only after these gates pass. Marketplace publication, account KYC and payout setup require the account owner.

**Truth label:** implementation candidate; not deployed, not a verified paid service, and not evidence of buyer demand or revenue.
