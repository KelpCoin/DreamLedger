# BrownEye Economic Fulfillment Worker

This is the execution half of the economic loop.

Flow:
1. An authorized marketplace actuator accepts a real buyer job.
2. The accepted work becomes a queued `jobs` record with an explicit economic-fulfillment type.
3. The worker leases the job.
4. It retrieves only the public sources specified by the job.
5. It produces source-linked rows, retrieval timestamps and SHA-256 evidence.
6. It writes JSON, CSV and a human-readable report.
7. The report is stored under `marketplace-fulfillment/economic-jobs/<job_id>/`.
8. Completion is acknowledged through the economic fulfillment RPC.
9. Payment remains a separate Truth Oracle condition. Fulfillment is not revenue.

Supported adapters: `api_json`, `html_table`, `html_links`.

Identity data is never invented. Names, IRD numbers, emails and similar fields must either be present in retrieved source material or remain absent/redacted.

The worker does not submit proposals, contact buyers, spend money, or log into marketplaces.