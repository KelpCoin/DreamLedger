# Private B2B inbound handoff (staged; NOT LIVE)

Owner: BrownEye Cortex shared engine. DreamLedger.org is a downstream public surface.

Current verified state:
- Existing Airtable Sales Pipeline base already exists. A PRIVATE table named
  DreamLedger Inbound Requests was created there with no customer records.
- A Cloudflare Worker handler has been staged as
  templates/rfq-inbox.worker.mjs. It is NOT wired to the G08 preview, which
  deliberately returns HTTP 503 for any stateful /api/rfq request.
- The static /api/inquiry-config preview route returns enabled=false. The
  B2B page disables submission unless real server configuration is enabled.
  It cannot claim a saved RFQ from browser localStorage.
- No payment or private file upload is offered.

Before an owner-approved NON-PREVIEW activation:
1. Complete the existing G08/G06/G16/G17 required migration gates.
2. Review personal-data handling, retention, complaint/contact policy, and
   the existing Airtable table ACLs.
3. Configure Cloudflare secret AIRTABLE_TOKEN with create-records-only
   permissions on the existing Sales Pipeline base.
4. Configure AIRTABLE_LEADS_BASE_ID and AIRTABLE_LEADS_TABLE_ID privately.
   Use the already-existing base and its new inbound table; do not invent IDs.
5. Configure TURNSTILE_SECRET and its corresponding TURNSTILE_SITE_KEY for
   the exact canonical website hostname. A failed challenge must reject POST.
6. Add Cloudflare WAF/rate limits, audit logging without PII, request-size
   limits, threat review, and owner-approved RFQ_INTAKE_ENABLED gate.
7. Wire handleRfqIntake into the separately reviewed production Worker route.
8. Prove a real allowed buyer enquiry stores a private Airtable record, returns
   a retrievable receipt, remains marked RECEIVED_UNVERIFIED, and can enter
   Cortex's approved private handoff without exposing customer contact data
   through GitHub Actions artifacts or model prompts.

Cloudflare's preview still reports 503 even with environment variables,
because preview acceptance forbids stateful routes. Existing test fixtures
simulate acknowledgements only; no actual customer or revenue is implied.

This inbox is NOT the financial ledger, provider-exit proof, a permission to
contact strangers, or the authority for Gauntlet to promote economic truth.
