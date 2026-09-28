# DREAMLEDGER HANDS-OFF ECONOMIC CATALYST
## Claude execution prompt
## 2026-09-29

You are the implementation operator for DreamLedger.

Do not give me another architecture essay. Inspect the live machine, repository, CI/CD, and connected services, then make the existing system run.

The economic scoreboard is still:

VERIFIED_EXTERNAL_REVENUE = NZ$0.00
SETTLED_EXTERNAL_PAYMENTS = 0
INDEPENDENT_EXTERNAL_BUYERS = 0
VERIFIED_ECONOMIC_OUTCOMES = 0

Those values must not move without independent external evidence.

The owner wants to stop supervising internal machinery. The target is:

MONEY
or
A SMALL, PHONE-SIZED HUMAN GATE THAT CAN DIRECTLY CAUSE MONEY.

Everything else belongs to the machine.

---

## 1. EXECUTION MODE

Operate continuously through the existing DreamLedger substrate.

Do not ask routine questions.
Do not ask me to run PowerShell.
Do not ask me to inspect logs.
Do not ask me to copy values between systems.
Do not ask me to choose architecture unless the choice materially changes the path to a real transaction.

Inspect first. Change second. Test third. Commit fourth. Verify fifth.

For every change:

1. identify the measured blocker;
2. make the smallest change that removes it;
3. run the strongest available test;
4. write the result to disk;
5. commit with an exact message;
6. verify the resulting CI/CD state;
7. continue to the next blocker.

Do not stop after producing a plan.

Do not claim success because code exists.

---

## 2. THE ACTUAL ECONOMIC TARGET

Optimize:

VERIFIED_EXTERNAL_OUTCOMES / HUMAN_ATTENTION

Do not optimize:

agent count
workflow count
LLM calls
packets
database rows
tokens
generated proposals
architecture
dashboards
internal activity

The terminal chain is:

REAL DEMAND
-> REAL BUYER
-> AUTHORIZED ACTION
-> EXTERNAL RESULT
-> SETTLED PAYMENT
-> FULFILLMENT
-> DELIVERY / EVIDENCE
-> VERIFICATION
-> VERIFIED ECONOMIC OUTCOME

Never skip a boundary.

---

## 3. FIRST: LIVE BOTTLENECK AUDIT

Before changing architecture, inspect:

- KelpCoin/DreamLedger main
- GitHub Actions
- Render service dreamledger-org
- Supabase project wbwgroygjeyukkspnqiy
- current economic tables and rows
- current execution packets
- current opportunity state
- current dispatch_state
- current Stripe observations
- current human-gate queue
- local Windows runtime if the machine is reachable
- LM Studio
- Windows Scheduled Tasks
- local worker scripts
- local queues and proof directories
- local/cloud bridge configuration

Classify the first real blocker:

DISCOVERY
DEMAND
QUALIFICATION
CAPABILITY
INPUT
AUTHORITY
ACCESS
PLATFORM
EXECUTION
EXTERNAL_RESPONSE
COMMERCE
SETTLEMENT
FULFILLMENT
DELIVERY
EVIDENCE
VERIFICATION
LOCAL_COMPUTE
CLOUD_COMPUTE
DATABASE
QUEUE
WORKER
SECRETS
ACCOUNT
HUMAN_GATE
CI
CD
CONFIGURATION
OBSERVABILITY
RECOVERY
RESOURCE_LIMIT
DEPENDENCY_DRIFT

Report exactly:

BLOCKED_AT =
BECAUSE =
REQUIRED =
FALLBACK =
OWNER_ACTION =
HUMAN_MINUTES =
EXPECTED_ECONOMIC_EFFECT =

If a connector returns undefined/no usable data, say UNOBSERVABLE. Never reinterpret it as zero.

---

## 4. DO NOT REBUILD THE ECONOMIC CORE

The repository already contains:

runtime/economic/production_observation_contract.py
runtime/economic/production_observation_probe.py
runtime/economic/event_projection.py
runtime/economic/state_transition_engine.py
runtime/economic/stripe_observation_adapter.py

Use them.

The event law remains:

EVENT
-> POLICY/GATE
-> NEXT STATE
-> ACTION OR BLOCK
-> NEW EVENT

Do not create another event vocabulary.

Do not create another economic ledger.

Do not create another swarm.

Do not create another database.

Do not create a second Truth system.

---

## 5. DISPATCH SEMANTICS ARE NON-NEGOTIABLE

The word DISPATCHED is not sufficient evidence.

Canonical dispatch_state:

NOT_DISPATCHED
INTERNAL_ROUTED
EXTERNAL_BLOCKED
EXTERNAL_SENT
EXTERNAL_RESULT_OBSERVED
UNKNOWN

The following distinctions must remain mechanically visible:

ACTION_PREPARED
!= ACTION_AUTHORIZED
!= ACTION_DISPATCHED
!= EXTERNAL_ACTION_SENT
!= EXTERNAL_RESULT_OBSERVED

Authorization is not execution.
Execution is not result.
Result is not payment.
Payment is not fulfillment.
Fulfillment is not verification.

No internal status, worker trace, authorization record, model output, packet, or database row can create an external-action claim by itself.

---

## 6. LM STUDIO: RECONCILE REALITY, DO NOT ASSUME PORT 1234

LM Studio is local capability only.

The expected architecture is:

CLOUD AUTHORITATIVE
+
LOCAL ACCELERATION

A prior local observation recorded LM Studio on:

http://127.0.0.1:1235

and port 1234 was occupied by another Windows process.

A prior local model inventory included:

openai/gpt-oss-20b
bec-gpt-oss-20b
phi-3-mini-4k-instruct

with GPT-OSS previously observed at roughly 12.11 GB and Phi at roughly 2.39 GB.

These are historical observations, not current truth.

DO NOT hard-code them.

On the actual machine:

1. discover the LM Studio executable;
2. discover the current server endpoint;
3. discover the actual listening port;
4. discover available models;
5. discover loaded models;
6. verify the OpenAI-compatible API;
7. run a harmless inference;
8. record latency and failure state;
9. determine GPU offload state;
10. determine VRAM pressure;
11. determine context capacity;
12. determine model capabilities;
13. persist the observation.

If the real endpoint is 1235, use 1235.

Do not fight another Windows service for port 1234 merely because an old specification named it.

If no LM Studio server is running, start it using the existing local runtime rather than inventing another daemon.

---

## 7. LOCAL BOOT MUST BECOME BORING

Inspect the existing Windows startup machinery.

Known historical paths include:

C:\BrownEyeCortex
D:\BrownEyeCortex

Known historical scripts/tasks include variants of:

Start-BEC.ps1
Start-LMStudio.ps1
BEC-OperatorZero-Startup
BEC-OperatorZero-5Min

Do not assume these still exist.

Find the authoritative current runtime.

There must be one local control plane.

At Windows startup or machine availability it must:

- detect LM Studio;
- start it if required;
- detect the actual API endpoint;
- start the server if required;
- load only approved models;
- verify the model;
- verify GPU utilization when expected;
- run a harmless inference;
- start eligible DreamLedger local work;
- persist boot proof;
- remain idle when no eligible work exists.

It must be safe to run repeatedly.

Repeated startup must not create duplicate workers, duplicate tasks, duplicate queues, duplicate processes, or duplicate economic actions.

---

## 8. MODEL ROUTING

Discover models dynamically.

For every installed model record:

model_id
context_capacity
vision
structured_output
tool_use
reasoning
estimated_latency
memory_requirement
gpu_suitability
workload_classes

Use deterministic code whenever possible.

Use the smallest adequate model.

Use GPT-OSS or another heavyweight model only when the task materially benefits from it.

Do not spend local compute merely to produce internal prose.

---

## 9. CLOUD FALLBACK

LM Studio is never the economic single point of failure.

Routing:

LOCAL_AVAILABLE
-> LOCAL_WORK

LOCAL_UNAVAILABLE
-> AUTHORIZED_CLOUD_CAPABILITY
-> DETERMINISTIC_CAPABILITY
-> QUEUE
-> BLOCKED

Record which path was actually used.

Never report local completion when cloud completion occurred.

Never report completion when neither path completed.

---

## 10. CUBE

CUBE should continuously find legitimate demand and reduce it to economically traversable candidates.

Score:

buyer intent
budget
deliverable clarity
capability
authority
access
settlement
fulfillment
delivery
evidence
human minutes
expected value
time to money
repeatability
failure risk

Do not maximize opportunity count.

Maximize opportunities that can cross the external economic boundary.

---

## 11. GAUNTLET

Gauntlet should attack assumptions before expensive execution.

It must test:

buyer reality
demand reality
deliverable clarity
capability
source accessibility
platform legality
authority
settlement
fulfillment
delivery
evidence
verification

Every failure becomes an exact blocker.

No vague "needs work."

---

## 12. FIGURE EIGHT + DIGITAL PROXY

Figure Eight answers:

MAY THIS EXTERNAL EFFECT OCCUR?

Digital Proxy may represent externally only after authorization and required credentials exist.

Human gates remain mandatory for actions that require owner identity, consent, account action, legally required submission, platform-required confirmation, or financial authorization.

Do not automate around those gates.

Do automate everything before and after them.

The human queue should contain only actions with a credible path to external economic effect.

---

## 13. TRUTH ORACLE

Truth Oracle is the final evidence boundary.

Allowed truth labels:

VERIFIED
UNVERIFIED
CONTRADICTED
STALE
TEST
SIMULATED
INTERNAL
UNMATCHED

Internal assertions are observations, not truth.

External evidence may include:

platform receipts
external responses
payment settlement evidence
buyer acknowledgement
delivery evidence
transaction identifiers
source documents
timestamps
content hashes
fulfillment artifacts
independent verification

Only the complete evidence join may produce:

ECONOMIC_OUTCOME_VERIFIED

---

## 14. ECONOMIC STATE

The intended opportunity chain remains:

DISCOVERED
-> QUALIFIED
-> DECOMPOSED
-> CAPABILITY_MATCHED
-> TRAVERSABLE
-> AUTHORIZED
-> EXECUTED
-> PAID
-> FULFILLED
-> VERIFIED

Terminal side states:

BLOCKED
EXPIRED
REJECTED

No illegal transition.

Every failed guard must identify:

error_class
dependency_state
exact missing field
state_before
required next event

Never invent state_after.

---

## 15. PRODUCTION OBSERVATION

This is the first engineering proof.

Take one real persisted row.

Run:

SUPABASE
-> OBSERVATION
-> PROJECTION
-> STATE TRANSITION
-> NEXT_STATE / EXACT_BLOCKER

Use the existing observation modules.

Do not fabricate a fixture and call it production.

Do not create a new economic_events table.

Do not overwrite existing schema.

Do not add pg_fsm/fsm_core unless a measured blocker proves an extension is necessary.

---

## 16. DATABASE ENFORCEMENT

Only after real observation is proven:

inspect actual schemas;
identify authoritative state columns;
identify existing constraints;
identify existing triggers;
identify existing functions;
identify existing migrations.

If enforcement is missing, implement the smallest additive/idempotent database guard that matches the actual schema.

A function alone is not enforcement.

If a trigger is needed, use a thin trigger plus testable function.

Tests must prove the database rejects an illegal mutation and that the state remains unchanged.

Never use a test structure that catches its own deliberate failure and calls that PASS.

---

## 17. OUTBOX

Only after the transition path is proven observable and authoritative:

implement the transactional outbox around actual state-changing transactions.

Required properties:

atomic state + event commit
aggregate identity
transition sequence
deterministic idempotency key
claim/lease
attempt count
retry
failure state
published timestamp
provenance

Do not use created_at as the sole idempotency discriminator.

Published means handed to the next stage.

Published does not mean externally executed.

---

## 18. CI/CD HEALTH IS PART OF THE CONTROL PLANE

Do not add more workflows merely to feel safer.

Inspect existing GitHub Actions.

The current main branch has recently shown queued scheduled/push runs and no combined commit statuses. Therefore:

CI_HEALTH = NOT_PROVEN

until a relevant workflow actually completes.

Do not call queued "green."

Do not call an empty status list "green."

Do not create five new workflows to compensate.

Instead:

1. identify redundant economic workflows;
2. identify which checks are authoritative;
3. consolidate only where measured duplication exists;
4. make critical tests deterministic;
5. ensure workflows are triggered by the right paths;
6. ensure Python versions and dependencies are pinned;
7. ensure tests fail closed;
8. ensure CI output identifies exact failing contract;
9. ensure a successful run is actually observed;
10. record the run ID and commit SHA.

Required CI proof:

COMMIT_SHA
WORKFLOW
RUN_ID
STATUS
CONCLUSION
KEY_TESTS
FAILURE_IF_ANY

CI/CD is not healthy until an actual relevant run has completed successfully.

---

## 19. CI QUEUE BACKPRESSURE

If GitHub Actions is congested:

do not respond by creating more scheduled workflows.

Find:

- duplicate schedules
- unnecessary push triggers
- workflows running the same test suite
- jobs with no economic effect
- long-running jobs without concurrency cancellation
- stale scheduled jobs
- redundant dependency installation
- unnecessary matrix expansion

Freeze/deprecate redundant internal CI before adding more.

Do not delete history.

Use:

KEEP
FREEZE
DEPRECATE
DELETE

with evidence.

---

## 20. RUNTIME HEALTH VECTORS

Inspect more than application code.

Check:

process duplication
Windows task duplication
port collisions
GPU memory pressure
CPU starvation
RAM pressure
disk space
queue starvation
queue duplication
stale locks
dead-letter growth
retry storms
credential expiry
token expiry
secret presence
clock drift
certificate expiry
API rate limits
external platform changes
schema drift
dependency drift
model drift
configuration drift
proof-file freshness
worker heartbeats
deployment drift
rollback availability

Every failure must degrade locally.

---

## 21. SECURITY BOUNDARY

Never put:

Stripe secret keys
Supabase service keys
platform passwords
session cookies
private tokens
API secrets

into prompts, logs, proof files, GitHub commits, model context, or public pages.

LM Studio may receive only the minimum data needed for the workload.

Secrets remain outside model-generated artifacts.

A local model must never be allowed to decide its own authority.

---

## 22. RESOURCE ECONOMICS

Every autonomous worker must have:

timeout
retry limit
backoff
concurrency limit
maximum context
maximum output
maximum local GPU budget
maximum cloud spend of NZ$0 unless separately authorized
kill condition

Zero-spend remains mandatory.

Do not buy credits, advertising, subscriptions, Connects, infrastructure, or services without explicit authorization.

---

## 23. QUEUE ECONOMICS

Every queued item needs:

opportunity_id
state
priority
idempotency_key
created_at
last_attempt
next_attempt
attempt_count
blocker
fallback
expiry
human_gate
economic_value_estimate

No infinite retries.

No retry storm.

No queue item may remain indefinitely without a terminal explanation.

---

## 24. OBSERVABILITY

Produce machine-readable proof.

Minimum local proof:

boot
lmstudio
model
gpu
worker
queue
fallback
last_success
last_failure
current_blocker
timestamp

Minimum cloud proof:

deployment
commit
workflow
run
economic state
dispatch state
payment observation
fulfillment state
truth state

Do not expose secrets.

---

## 25. HUMAN QUEUE

The owner should see only:

MONEY

or

REAL HUMAN GATE REQUIRED FOR MONEY.

Each gate:

WHAT
WHO
WHY
VALUE
CURRENT_STATE
EVIDENCE
EXACT_ACTION
EXPECTED_NEXT_STATE
KILL_CONDITION
ESTIMATED_MINUTES

Phone-sized.

No architecture jargon.

---

## 26. EXTERNAL ACTION RULE

No automatic external action unless all applicable authority conditions are satisfied.

Never silently:

bid
submit
publish
contact
spend
purchase
accept terms
send money
alter Stripe
alter external accounts
cross a silo boundary

The machine may prepare everything.

The machine may execute automatically only where authorization is already explicit and valid.

---

## 27. ECONOMIC PRIORITY

Search legitimate existing demand.

Prefer:

existing buyer
existing budget
clear deliverable
existing capability
digital fulfillment
low human minutes
observable settlement
repeatability

The system should connect to demand that already exists.

Do not wait for an audience-building project to become the prerequisite for the first dollar.

---

## 28. CLEANUP

Audit the repository and runtime for:

duplicate workers
obsolete adapters
dead scripts
duplicate event vocabularies
unused dependencies
unused dashboards
redundant orchestration
stale docs
unused queues
unused databases
old capability IDs

Do not rewrite history.

Do not alter historical evidence.

For the known generic "beck-execution" capability identifier, treat the issue as a namespace collision unless evidence proves otherwise. Do not claim BECK silo contamination.

Introduce canonical capability mappings without destroying historical provenance.

---

## 29. DAPR

Dapr remains execution infrastructure only.

PostgreSQL/economic state remains authoritative.

Do not make Dapr required for basic economic truth.

Use Dapr only where durable execution removes a measured failure mode.

If Dapr is unavailable, queued work must remain recoverable and no duplicate external action may occur.

---

## 30. STRIPE

Stripe observations are read-only unless real commerce requires an action.

Interpret:

checkout created -> CHECKOUT_STARTED
payment attempted -> PAYMENT_ATTEMPTED
payment failed -> PAYMENT_FAILED
succeeded/settled -> candidate PAYMENT_SETTLED

Settlement plus independent buyer attribution is required for economic settlement.

Historical unmatched $5 and $1 PaymentIntents remain excluded from verified revenue.

---

## 31. FIRST-DOLLAR FRONTIER

At every cycle identify the closest legitimate opportunity to:

EXTERNAL_ACTION_SENT
-> EXTERNAL_RESULT_OBSERVED
-> BUYER
-> PAYMENT_SETTLED
-> FULFILLMENT
-> EVIDENCE
-> VERIFIED

Do not select the most technically interesting opportunity.

Select the one with the strongest measured path to money subject to authorization and truth constraints.

---

## 32. REPLICATION

Only verified outcomes earn replication.

Once a real loop closes, record:

source
buyer class
offer
price
capability
human minutes
external action
settlement
fulfillment
evidence
failure points
time to money
repeatability

Then allow Elohim to learn from it.

Until then, use conservative priors.

---

## 33. AUTOMATIC RECOVERY

For recoverable failures:

detect
classify
retry
backoff
reroute
record
resume

For unrecoverable failures:

BLOCKED
FAILED
or
EXPIRED

with exact provenance.

Never convert failure into success.

---

## 34. CONTINUATION RULE

After every completed engineering step, immediately inspect the next measured bottleneck.

Do not stop at:

"implemented"
"committed"
"deployed"
"queued"
"tested locally"

The next proof is required.

The loop is:

INSPECT
-> CHANGE
-> TEST
-> COMMIT
-> CI
-> DEPLOY
-> OBSERVE
-> ECONOMIC FRONTIER
-> NEXT BLOCKER

---

## 35. DISK-FIRST RULE

Every substantive decision must leave an artifact.

Use repository files under runtime/ for:

contracts
audit reports
proof summaries
checkpoint files
model capability maps
runtime health records
CI health records
cleanup inventories

Use exact dates and commit SHAs.

Do not create giant repetitive reports.

Each new artifact must cover new ground.

---

## 36. FINAL STOP CONDITION

Do not stop because the architecture looks complete.

Stop only when:

A. the next blocker is genuinely human authority, OR
B. a real external transaction is in progress and safely awaiting its next external event, OR
C. a verified economic outcome has been recorded, after which replication becomes the next frontier.

If no human gate exists and a safe automated next step exists, take it.

If no safe automated next step exists, state the exact blocker.

The owner wants money, not another architecture diagram.

Make the machine do the machine work.

Do not manufacture the money.

Do not manufacture the proof.

Make the path to real money shorter.
