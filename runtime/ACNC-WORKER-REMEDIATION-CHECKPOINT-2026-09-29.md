# ACNC WORKER REMEDIATION CHECKPOINT
## 2026-09-29

The live economic blocker was identified in Supabase from the persisted ACNC execution action.

BLOCKED_AT = WORKER
BECAUSE = economic-fulfillment-dispatch received HTTP 502 from ACNC_RESEARCH_WORKER with WORKER_RESOURCE_LIMIT / insufficient compute resources
REQUIRED = avoid full-file ACNC CSV download and in-memory parsing inside the Edge Function
FALLBACK = authoritative Data.gov.au CKAN DataStore query with server-side State filtering
OWNER_ACTION = NONE
HUMAN_MINUTES = 0
EXPECTED_ECONOMIC_EFFECT = restore the authorized ACNC fulfillment path toward the NZ$850 opportunity

Observed packet:
- packet_id: bf10b05e-b6ef-488d-bf6c-017a20fe37cd
- opportunity_id: 645c95cd-2e69-4f07-9ca2-c987af49f7b6
- capability_id: ACNC_RESEARCH_WORKER
- dispatch_state: INTERNAL_ROUTED
- authorization_verdict: allow
- action execution_state: FAILED
- external_reference: null
- evidence_reference: null

The remediation changed the worker from full CSV parsing to CKAN DataStore access. The public resource metadata identifies the ACNC CSV resource as 14.1 MiB and states that the DataStore is active and contains all records.

Production Edge Function:
- acnc-research-worker
- version: 4
- status: ACTIVE
- verify_jwt: true
- bundle hash: b3c470c54ae6c8fa813020282cc9386af4f9ee41b5ae0c2e0d23abdfebe4689

Repository source of the deployed worker:
runtime/supabase-functions/acnc-research-worker/index.ts
commit: c08a7e19795377610ee1803cfc40f2f6862c2f3a

The version-4 source was verified to reference CKAN and contains no stale CKCN endpoint typo.

Invocation proof is still absent because the connected Supabase toolset exposes deployment and inspection but not an Edge Function invocation operation in this session. Therefore this checkpoint does not claim the resource-limit blocker is cleared in live execution.

Production truth remains:
VERIFIED_EXTERNAL_REVENUE = NZ$0.00
SETTLED_EXTERNAL_PAYMENTS = 0
INDEPENDENT_EXTERNAL_BUYERS = 0
VERIFIED_ECONOMIC_OUTCOMES = 0

Next proof:
1. existing fulfillment path invokes ACNC_RESEARCH_WORKER v4;
2. actual result is observed;
3. if successful, the next blocker is decision-maker enrichment;
4. if unsuccessful, record the exact new failure;
5. do not promote INTERNAL_ROUTED to EXTERNAL_ACTION_SENT.

CI/CD remains NOT_PROVEN. No new CI workflow was created.
