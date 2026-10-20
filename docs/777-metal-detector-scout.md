# 777 Metal-Detector Scout (initial integration)

## Purpose
A six-hourly, append-preserving source harvester feeding DreamLedger's 777 discovery layer. It does not replace the existing CUBE radar, 777 search, Elohim, Gauntlet, economic activation, or commercial fulfillment chain.

## Flow
Public source -> raw JSON + canonical hash -> `scout_findings` -> future local LM Studio assessment -> explicit review -> existing 777 opportunity/economic gate. The current integration implements durable harvesting and run receipts only. It deliberately does not claim classification, scoring, review-queue integration, or revenue until those paths are implemented and verified.

## Sources
- MCP Registry API
- RemoteOK API
- Arbeitnow job-board API
- Optional HTTPS feed configured as GitHub Actions variable `SCOUT_X402_FEED_URL`; no endpoint is assumed to exist.

A source outage is recorded per source; it does not silently mean there was no demand. The harvester does not score or filter returned items.

## Security and truth
- GitHub Actions uses the existing server-side Supabase secret `SUPABASE_SECRET_KEY`; it is never passed to a model or Windows worker by this workflow.
- All scout tables have RLS enabled and deny `anon` and `authenticated` access until purpose-built policies exist.
- Scout findings never enter `economic_ledger`. No zero-dollar placeholder, fake settlement, or `PENDING_SIGN` is created. Raw payloads are retained even when discarded; evidence hash/signature/canonical payload fields are for the discovery packet only, and a signature is valid only when produced and verified by the repository's actual signing implementation.
- Scoring rubric: Reuse 0–30 + Revenue 0–40 + Leverage 0–20 + Novelty 0–10 − Cost penalty 0–10; positive maximum 100. The score is a prioritization aid, not judge reliability or buyer proof.
- Durable retries require a verified queue implementation, bounded worker, visibility timeout/retry and DLQ. `waitUntil()` is not a durable queue. Local LM Studio cannot be reached through Edge Function `localhost`; the PC worker must use a secured bridge/tunnel or outbound polling and must never receive the Supabase service-role key.
- Repeated identical source payloads are idempotently upserted by source + SHA-256; first-seen evidence remains and last-seen is refreshed.
- Revenue stays whatever the authoritative payment/settlement pipeline proves. Harvest counts are not buyers, orders, conversions, or revenue.

## Next integration gates
1. Apply the migration and verify table privileges.
2. Run the workflow once manually and inspect its JSON receipt plus rows.
3. Add the local LM Studio classifier/scorer as a separate retryable worker, validating the actually loaded model and inference response.
4. Connect reviewed candidates to the existing 777 opportunity intake only after its exact contract is inspected.
5. Add a human review surface. Do not wire scout finds directly to external actions.
