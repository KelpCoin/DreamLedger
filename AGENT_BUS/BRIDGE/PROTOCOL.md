# Agent Bridge protocol v1.1

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

## Cross-device / Multi-LLM Synchronization (v1.2, 2026-10-09)

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
