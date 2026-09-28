# LIVE ECONOMIC BLOCKER AND ACNC RESOURCE REMEDIATION
## 2026-09-29

### Live observation

The connected Supabase project is observable.

Current counts:
- economic_execution_packets: 15
- economic_actions: 2746
- cube_opportunities: 131
- economic_approval_queue: 0
- economic_outcomes: 0
- economic_events: 3
- economic_outbox: 115

The latest economically relevant packet is:
- packet: bf10b05e-b6ef-488d-bf6c-017a20fe37cd
- opportunity: 645c95cd-2e69-4f07-9ca2-c987af49f7b6
- capability: ACNC_RESEARCH_WORKER
- opportunity status: INTERESTING
- expected value: NZ$850
- packet status: DISPATCHED
- authorization_verdict: allow
- dispatch_state: INTERNAL_ROUTED
- action execution_state: FAILED

### Exact economic blocker

BLOCKED_AT = WORKER
BECAUSE = economic-fulfillment-dispatch returned HTTP 502 because ACNC_RESEARCH_WORKER failed with WORKER_RESOURCE_LIMIT / insufficient compute resources
REQUIRED = a bounded ACNC extraction path that does not download and parse the entire 14.1 MiB CSV in the Edge Function
FALLBACK = CKAN DataStore query against the same authoritative ACNC CSV resource, with server-side State filtering and bounded result limit
OWNER_ACTION = NONE
HUMAN_MINUTES = 0 for this engineering remediation
EXPECTED_ECONOMIC_EFFECT = restore the already-authorized internal fulfillment path for the NZ$850 ACNC opportunity; external submission remains separately human-gated

### What was found in the worker

Version 2 downloaded the complete ACNC CSV, parsed every row into memory, then filtered to WA and sliced the output. The public Data.gov.au resource is 14.1 MiB and its current resource metadata states that the DataStore is active and contains all source-file records.

That makes the prior worker's full-file parse a measured resource hotspot, not a reason to add another orchestrator.

### Change applied

ACNC_RESEARCH_WORKER was deployed as version 3.

The worker now:
1. retrieves the current ACNC dataset metadata;
2. resolves the active CSV resource ID;
3. queries the Data.gov.au CKAN DataStore rather than downloading the whole CSV;
4. applies State filtering server-side;
5. optionally applies the CKAN query parameter;
6. bounds returned records to 5,000;
7. preserves provenance and the existing output schema;
8. continues to mark decision-maker enrichment unresolved rather than fabricating it.

Supabase deployment result:
- function: acnc-research-worker
- version: 3
- status: ACTIVE
- verify_jwt: true
- deployed bundle hash: bb06a6a227cdf9794809c0a033791a35ae25a0e7833a5b1e000255730ec1b66f

### Production invocation boundary

The connected Supabase tools can deploy and inspect Edge Functions but do not expose an invocation operation in this session.

Therefore:
- deployment = PROVEN
- live invocation after version 3 = UNOBSERVED
- resource-limit failure = PROVEN from the persisted action result
- external action = NOT SENT
- buyer = 0
- settlement = 0
- fulfillment = 0
- verified outcomes = 0

Do not upgrade the scoreboard.

### Production observation contract

The actual persisted packet is suitable input to the existing observation/projection layer for dispatch semantics:

authorization_verdict=allow
dispatch_state=INTERNAL_ROUTED

The projection therefore yields ACTION_AUTHORIZED and ACTION_DISPATCHED candidates, not EXTERNAL_ACTION_SENT.

The state-transition module requires an explicit opportunity_state field. That field is not present on the persisted execution packet and there is no matching economic_transitions row for this opportunity. Therefore a direct packet-only state transition must return an exact data blocker rather than inventing state.

### CI/CD boundary

Main currently has no combined status entries and the commit-specific workflow connector returned no workflow runs. CI_HEALTH remains NOT_PROVEN.

No new CI workflow was created.

### Next measured frontier

1. obtain a real invocation of ACNC_RESEARCH_WORKER v3 through the existing fulfillment path;
2. observe whether the resource-limit failure is removed;
3. if it succeeds, continue to the existing decision-maker enrichment blocker;
4. if it fails, record the new exact resource or dependency failure;
5. only after a completed run, update the economic packet state based on observed evidence.

No external submission is authorized by this remediation.
