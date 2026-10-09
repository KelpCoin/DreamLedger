# Agent Bridge protocol v1.3

**Purpose:** LLMs and operators on different devices share durable work via Git — local air-gap and cloud together.

**Not a payment system.** Bridge moves work state. Stripe + Settlement Sync move money truth.

---

## Dual-mode

| Mode | Persist |
|------|--------|
| Air-gap | `BRIDGE/local_queue/` then push when online |
| Cloud | Actions + `BRIDGE/outbox` commits |
| Hybrid | Local draft → git push → cloud verify → human distribute |

```
LOCAL PC ──ping──► GitHub AGENT_BUS ──pong──► next agent
              │
              ├── ECONOMIC-LOOPS/registry.json
              ├── ops/money/* (revenue execution)
              └── sentinels / settlement (cloud)
```

---

## Router rules (v1.1)

1. **Read order:** `PING_PONG_BALLS.json` → latest `HANDOFF-*.md` → `ECONOMIC-LOOPS/registry.json` → `BRIDGE/inbox/`  
2. **Write order:** code/docs → `HANDOFF-*.md` → optional ping in `outbox/` → push  
3. **Inbox processing:** run `python3 scripts/bridge_process_inbox.py` to move processed pings and emit pongs  
4. **Ball C priority:** money distribution beats new architecture unless blocker is settlement/fulfil  
5. **Revenue fields:** always 0 without external fossil evidence  
6. **Public surface:** never write ops jargon into `public/*.html`  

---

## Ping / pong schemas

### Ping

```json
{
  "schema": "dreamledger/agent-bridge-ping/v1",
  "ping_id": "ping-…",
  "from": "agent-id",
  "mode": "airgap|cloud|hybrid",
  "ball": "C",
  "intent": "observe|build|verify|handoff|money",
  "summary": "one line",
  "reads": [],
  "writes": [],
  "revenue_claim_nzd": 0,
  "needs_human": false,
  "created_at": "ISO-8601"
}
```

### Pong

```json
{
  "schema": "dreamledger/agent-bridge-pong/v1",
  "pong_id": "pong-…",
  "in_reply_to": "ping-…",
  "from": "…",
  "status": "accepted|rejected|blocked|done",
  "summary": "one line",
  "verified_external_revenue_nzd": 0,
  "next_ball": "C",
  "created_at": "ISO-8601"
}
```

---

## Health

```bash
python3 scripts/bridge_process_inbox.py --dry-run
python3 scripts/loop_status.py
python3 scripts/bridge_ping.py --summary "heartbeat" --mode hybrid
```

Cloud: Actions → Cloud Demand + Intent Sentinels; Commerce Settlement Sync.

---

## Money relationship

Bridge coordinates. **DEMAND-KIT + external pay** produce revenue.


---

## Cross-device / Multi-LLM Synchronization (v1.3, 2026-10-09)

**Shared North Star:** every authorized node (owner's phone LLMs, spouse's phone LLMs, local LM Studio, cloud agents, and future friends explicitly invited by the owner) works against the same repository and shared brief. A model/device is a worker, not a separate source of truth.

### Task ownership and safe parallelism
- Claim a task before modifying files; include a stable task ID and explicit target paths.
- One active writer per target path. Parallelize only across disjoint paths or review-only tasks.
- Record the exact base commit SHA. Before applying a handoff, compare current target state and inspect diffs; reject stale overwrites.
- Every handoff records owner/node, status, target paths, base commit, branch/commit SHA, input/output artifact links and hashes, tests/results, truth label, blocker, next owner, and timestamp.
- Nodes without Git write access submit a patch/diff or Markdown handoff; never imply a local draft changed canonical code.
- GitHub is canonical for source/specs/tests/commits, Notion for decisions, Airtable for registry snapshots. Cross-link artifacts instead of forking truth.
- LM Studio is optional acceleration; cloud work continues when desktop is offline. Phone LLMs may research, plan, triage and review without production privileges.
- Future friends require explicit invitation, individual identities and least privilege. No shared accounts or secrets.
- Never include API keys, webhook URLs, private signing keys, payment credentials, or sensitive personal data in prompts, pings, issues, Notion or Airtable.
- Bridge coordination is not permission. External outreach, spending, payments, account changes, secret access and irreversible production actions remain behind existing human/policy gates.
- Resolve disagreement using canonical commits, tests and independent evidence, not model seniority. Every blocker names a next action and next owner. Do not create a parallel queue, ledger or orchestrator.
- Internal dispatch, builds, traffic, listings and simulated/test payments are not revenue.

### Optional extended ping fields
Existing v1 ping/pong fields remain valid. Producers may add:
```json
{
  "task_id": "task-...",
  "owner_node": "phone|lmstudio|cloud|human",
  "target_paths": [],
  "base_commit_sha": "...",
  "branch": "...",
  "commit_sha": null,
  "artifact_refs": [],
  "test_results": [],
  "truth_label": "UNVERIFIED",
  "blocker": null,
  "next_owner": "...",
  "updated_at": "ISO-8601"
}
```

### Shared portfolio direction
Free quote comparison and document extraction are eligible acquisition utilities. Do not privilege QUOTE-COMPARE-49 or any single funnel. MTG remains the reference silo; Music & Media inherits its listing lifecycle with vinyl and fair, auditable auctions; FightEdge uses the canonical silo contract. Preserve payment idempotency, durable ledger evidence, settlement-to-fulfillment proof and user-controlled engagement.

**Protocol:** CLAIM → READ NORTH STAR + CURRENT COMMIT → WORK IN SCOPED PATHS → TEST → PUBLISH COMMIT/ARTIFACT + HASH → UPDATE HANDOFF → REVIEW → AUTHORIZED MERGE/DEPLOY → VERIFY EXTERNAL RESULT.

**Honesty boundary:** this protocol defines the contract but does not prove every device/model is automatically connected to a live runtime. Each integration must be wired and observed before claiming automatic cross-device synchronization.


---

## Shared North Star + Commerce Reference Contract (v1.3)

This section is the common brief for all participating models and devices. Read it before taking work; write a handoff after work. A phone session does not become connected to the bridge merely because this file exists. The session must read the current canonical brief and publish a patch, issue, commit, or handoff through an authorized path.

### One project, role-scoped collaborators

- **Canonical project:** `KelpCoin/DreamLedger`. GitHub owns code, schemas, tests and versioned specifications; Notion owns human-readable decisions; Airtable is a control mirror, never economic source of truth.
- **Participants:** cloud agents, ChatGPT, owner's phone LLMs, spouse's phone LLMs, optional local LM Studio and future friends invited individually by the owner.
- **Access tiers:** reviewer (read/comment); contributor (branch/patch on assigned paths); maintainer (merge/release); owner-authorized operator (specific external action). Invite each person/account individually and grant least privilege. No shared accounts, API keys or copied secrets.
- **Device availability:** local LM Studio accelerates work when online; cloud remains available when it is offline. A phone-only worker can research, specify, review and submit a patch/handoff without production credentials.
- **Disagreement:** canonical current commit + reproducible tests + independent evidence outrank model confidence or seniority.

### Task envelope required for meaningful handoff

Every non-trivial task should record: `task_id`, `north_star`, `owner_node`, `scope`, `target_paths`, `base_commit_sha`, `branch`, `artifact_refs`, `artifact_hashes`, `tests`, `truth_label`, `blocker`, `next_owner`, `updated_at`. Claim before editing; one writer per path; compare current base before applying patches; never overwrite a newer change without review. Use existing Git/Agent Bridge inbox/outbox and handoff conventions, not a new queue.

### Portfolio and marketplace direction

- The target is a broad portfolio of offer experiments and reusable economic primitives, not one funnel. Quote comparison and document extraction may be free acquisition magnets. Any paid tier or toll must be tested against actual demand, fulfillment cost and contribution economics.
- MTG is the reference silo/template, not the company's sole product. Music & Media should reuse the canonical listing lifecycle and extend it for vinyl releases/pressings, item-specific photos, media/sleeve condition, wantlists, collections, CSV export, price history, seller/shipping terms, reputation and auditable auctions.
- FightEdge is an ordinary silo and must use the canonical DreamLedger silo/deployment contract.
- Free B2B listings and zero-fee peer transactions remain the default hypothesis. Potential monetization (evidence receipts, verification, premium tools, A2A access, priority placement) is experimental until users demonstrate willingness to pay. Do not present illustrative target prices or volume forecasts as observed demand.

### Commerce correctness gates (design requirements, not deployment claims)

- **Webhook:** verify the provider signature against the raw request body; durably insert the provider event ID under a unique constraint and process the event atomically/idempotently. A SELECT-first check is not the deduplication boundary.
- **Ledger:** durable database-assigned ordering and transaction serialization; database-enforced append-only permissions/triggers; hash-chain verification and concurrency tests. An environment variable is not authoritative ledger-head state. A trigger alone is not a substitute for restricted privileges and verified write serialization.
- **Auction:** durable Postgres state, row lock/transaction for each bid, validate auction status and minimum bid, and apply anti-sniping extension in the same transaction as bid acceptance. Expired auctions do not silently restart. Settlement and fulfillment are separate states.
- **Evidence:** distinguish payment settlement, entitlement, fulfillment, delivery and evidence sealing. Receipts need stable identifiers, canonical serialization, hash verification and key-management/signature verification. Never claim a signature, receipt, event, endpoint or table is deployed until inspected and tested.
- **Reputation and retention:** reputation is transaction-evidence-backed and portable only with user consent; keep bidding rules, closing times and spend controls transparent. Avoid manipulative retention patterns.
- **Truth:** listings, checkout links, API calls, test transactions, CI, deploys and internal receipts do not establish external revenue. `VERIFIED_EXTERNAL_REVENUE = NZ$0.00` until an independent buyer, settled external payment, fulfillment and delivery evidence are verified.

### Definition of synchronized

A participant is **brief-aware** after reading the current protocol and North Star; **handoff-connected** after publishing a traceable artifact; **runtime-connected** only after a live integration test demonstrates reading/writing the shared task state with least-privilege identity. Do not conflate these states. No automatic phone-to-phone, phone-to-desktop or friend access is implied by a GitHub document or a Notion/Airtable update.


---

## Commercial execution kernel (v1.4, 2026-10-09)

**Mandatory for every Agent Bridge task:** read this section and `AGENT_BUS/MONEY-PLAYBOOK-500.md` (canonical entry point) before taking action. For commercial/economic tasks, consult `AGENT_BUS/MONEY-PLAYBOOK-INDEX.json`; load `AGENT_BUS/BRIDGE/COMMERCIAL_ROUTES_CATALOG.md` only when ranking or generating new candidates. The 600-entry expansion is supplementary hypotheses, not a replacement for the canonical playbook or proof of market demand.

### Mission and scoreboard
- Mission: produce a useful outcome for a real external buyer, collect a settled payment, fulfill the promise, retain delivery evidence, and independently verify the loop. Then replicate the proven mechanism.
- Current economic truth stays `VERIFIED_EXTERNAL_REVENUE = NZ$0.00` until authoritative evidence establishes otherwise. Never infer revenue from a checkout link, listing, page view, click, test payment, internal dispatch, CI, deploy, or generated artifact.
- The 600 catalog entries are hypotheses, not 600 offers, validated markets, or a forecast. Rank with evidence and contribution economics, not novelty.

### Execution order
1. **Inspect existing substrate first:** canonical published offers and payment links, live public pages, Agent Bridge, CUBE/Elohim/Gauntlet, existing economic observation modules, current Airtable/Notion records. Do not create a duplicate ledger, queue, orchestrator, offer registry, or truth system.
2. **Verify the customer path before promotion:** exact public URL, mobile usability, CTA destination, price/currency, input capture, fulfillment method, privacy, refund terms, platform eligibility and payout setup. A PR or expected URL is not a live surface.
3. **Choose one bounded experiment at a time per attributable cell:** no upfront spend; use an existing lawful/consented distribution surface; define audience, offer, message, CTA, attribution, delivery cost, expected contribution margin and stop condition.
4. **Expose only after existing authorization/policy gates:** no unsolicited bulk DMs, spam, fake reviews, deceptive claims, unlicensed data, unauthorized scraping, or paid spend without approval. Account creation, identity checks, payout changes, and legally consequential representations remain human-controlled.
5. **Record the funnel separately:** qualified exposure → visit → input/lead → checkout start → paid/settled → fulfilled → delivered → independently verified. Diagnose the earliest broken transition; do not answer weak conversion by adding infrastructure.
6. **Manual fulfillment is allowed only as a bounded demand test** where truthful and deliverable. Before scaling, automate or cap the work and measure contribution margin and delivery quality.
7. **Replicate only after proof:** require an independent buyer and settled external payment, plus fulfillment and delivery evidence. Prefer a verified repeat or second independent buyer before declaring the mechanism evergreen.

### Agent output contract
Every commercial task returns: candidate/offer ID; source and current status; customer and job-to-be-done; existing surface/checkout URL; input and fulfillment path; platform fees/payout caveats; no-capital acquisition experiment; attribution plan; success and stop conditions; evidence references; truth label; next action. Existing distribution instructions in the legacy playbook are subordinate to current authorization rules: do not publish, message, spend, or change accounts without the required approval. Mark unsupported platform claims `UNVERIFIED` and research them from current official terms before relying on them.

### Existing platform caveats
- Metafy Core currently advertises free entry with 12% + US$1.79 per transaction, capped at 30% of earnings; payout identity verification and local payout availability still require account-level verification.
- Fiverr seller terms credit 80% of order value; confirm category rules, onboarding and payout availability.
- Trade Me's casual Marketplace success-fee removal does not automatically apply to Services listings or professional/in-trade services. Services are a lead/listing surface; verify current listing fee and terms before treating it as checkout.
- Stripe Payment Links support up to three customer custom fields, but the actual canonical link must be inspected and tested before claiming fields are live.
- Lemon Squeezy payout-country eligibility, account approval and total fees must be confirmed in the merchant account before dependency.
- These details are dated research, not account-specific guarantees. Recheck official terms before launch.

**Compact rule:** MONEY OUTCOMES > BUILD ACTIVITY. Use the catalog to discover candidates, but the next action must address the earliest unproven step in a real customer-to-cash loop.


---

## Cross-project BECK productization direction (2026-10-09)

When any agent/LLM works on BECK, BEC-PRIME, Agent Bridge, or developer-tool monetization, it MUST read `AGENT_BUS/BRIDGE/BECK_PRODUCTIZATION_GTM.md` alongside this protocol and the canonical Money Playbook.

The strategy is open-core: a minimal, independently installable public action-governance runtime at $0; optional hosted Pro/Team; Enterprise only after buyer discovery. The proposed $49/month or $399/year Pro, $199/month Team, and $50,000/year Enterprise prices are hypotheses until currency, delivery scope, cost-to-serve and willingness-to-pay are verified.

Do not expose the whole BECK/DreamLedger repository or private silo data. Extract only an audited clean core after verifying ownership, licenses, dependencies and private assumptions. Do not claim the runtime is stdlib-only, the package name is available, a public repo/PyPI release exists, or benchmark results exist until checked. Existing BECK source search did not find `bec_runtime.py` at the assumed path; locate the actual canonical source or write a small clean implementation against the documented contract.

The first release gate is source/license audit + deterministic security tests, not launch posting. Then public repo/README, package build and smoke test, one demo, one integration guide, honest comparison, reproducible benchmark, and human-authored distribution. HN, PyPI, stars, downloads, and demo views are not revenue. Paid tier revenue requires a real buyer, settled payment, delivered hosted capability and retained evidence.

Avoid unsupported “AI safety solved” claims. Document the bypass threat model: a wrapper cannot stop bypass if an agent can directly call the underlying tool. Do not publish destructive demos, fake stars, spam, or unverified competitor comparisons.
