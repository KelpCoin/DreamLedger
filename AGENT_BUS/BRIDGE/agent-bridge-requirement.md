# Agent Bridge Requirement — First Dollar External Distribution

**Status:** ACTIVE · MACHINE-READABLE · 2026-10-06  
**Location:** `AGENT_BUS/BRIDGE/agent-bridge-requirement.md` · also repo root `agent-bridge-requirement.md`  
**Related:** Notion Agent Ridge (Governance & Safeguards), Blocker B04 Rank 1, Spike 191

---

## FIRST_DOLLAR_STATUS

```
FIRST_DOLLAR_STATUS: BLOCKED_AT_HUMAN_AUTHORIZATION
BLOCKED_AT: EXTERNAL_DISTRIBUTION
CURRENT_STATE: GAUNTLET_AUTHORIZED → EXTERNAL_BLOCKED
```

**Correction:** A present `DISCORD_WEBHOOK` secret makes an action *technically possible*. It does **not** make autonomous public outreach *authorized*. Governance forbids treating credential existence as permission to promote.

---

## What is proven (do not re-litigate)

1. **Gauntlet → authorization bridge is real.**  
   Production Run #8:
   - `ELOHIM_AUTHORIZATION=APPROVED_OPERATOR_ARTIFACT`
   - `gauntlet_status=PASS`
   - `operator_approval=true`
   - `authorization_scope=ONE_DISCORD_PUBLICATION`

2. **Offer-ID match defect repaired.**  
   Commit `282b80b8eafa7a4d657a09c6aac2501fea05270e`  
   Canonical ID: `OFFER-CMD-DIAG-29-NZD` accepted by acquisition workflow.

3. **Workflow reaches the external-action boundary.**  
   Technical path works far enough to hit the Discord credential check.

4. **No external POST has occurred.**  
   No Discord message ID, no channel ID, no external-send evidence.  
   State is **EXTERNAL_BLOCKED**, not VISITOR_EXPOSED_PENDING_CHECKOUT.

5. **CMD-DIAG-29 commerce rail is the cleaner preferred offer.**  
   - Offer: Commander Deck Diagnostic  
   - Price: NZ$29  
   - Stripe live link cold-tested reachable (no purchase)  
   - Public `/mtg` surface; `VERIFIED_AVAILABLE`  
   - **Do not** advertise QUOTE-COMPARE-49 until its Stripe doorway passes a fresh cold-buyer checkout test (prior failure recorded).

6. **Render healthy** for this frontier.

7. **Supabase remains UNOBSERVABLE** (observation gap only).

---

## Exact blocker

| Field | Value |
|-------|--------|
| Class | Human / policy authorization for external distribution |
| Not | “Missing webhook only” |
| Component | Existing Discord acquisition workflow + credential boundary + external-channel governance |
| Failure mode | Credential may be installable; autonomous outreach is not permitted without explicit human authorization for one specific publication |
| Code change required | **None** |
| New dispatcher / product / architecture | **None** |

**Chain (current):**

```
CUBE / demand
→ existing offer (CMD-DIAG-29)
→ Gauntlet PASS
→ machine authorization
→ existing Discord dispatch workflow
→ HUMAN/POLICY AUTHORIZATION   ← blocked here
→ external publication
→ buyer
→ Stripe settlement
→ fulfillment
→ independent evidence
```

---

## Owner action only (HUMAN_MINUTES: <2)

Authorize **one exact** commercial publication, or decline.

Required form of approval (do not invent fields):

- Exact offer (prefer `OFFER-CMD-DIAG-29-NZD` / Commander Deck Diagnostic NZ$29)
- Exact authorized destination (Discord channel / webhook already under policy)
- Concrete demand context **if** any is claimed — do not fabricate buyer requests
- Confirmation that the payment doorway is live (CMD-DIAG-29 already cold-verified)

If approval is given:

1. Ensure `DISCORD_WEBHOOK` is set for the **authorized** destination only (Settings → Secrets → Actions).  
   **Do not paste the webhook value into chat, issues, PRs, or agents.**
2. Re-run the existing approved acquisition workflow for that one publication.
3. Require read-back evidence before claiming EXTERNAL_SENT.

If no concrete, evidenced demand context exists for a targeted response, the legitimate state remains **EXTERNAL_BLOCKED**. Do not invent a recipient or relevance story.

---

## Evidence required for next state

```
EXTERNAL_PUBLICATION = VERIFIED_DISCORD_MESSAGE
```

Must include:
- External message ID
- Destination / channel ID
- Timestamp
- Exact published offer
- Functioning payment doorway in the published content

Only then: `NEXT_ECONOMIC_STATE: EXTERNAL_SENT`  
Then wait. No fake conversion. No invented buyer. No engagement promoted to commerce.

---

## Economic scoreboard (frozen until evidence)

```
VERIFIED_EXTERNAL_REVENUE:     NZ$0.00
SETTLED_EXTERNAL_PAYMENTS:     0
INDEPENDENT_EXTERNAL_BUYERS:   0
PAID_FULFILLED_ORDERS:         0
VERIFIED_ECONOMIC_OUTCOMES:    0
```

Historical Stripe PaymentIntents with empty metadata are **not** attributed here.

---

## Factory / Digital Proxy doctrine (compatible, constrained)

The factory may manufacture businesses **only** when there is an evidenced path to a buyer — not because it can manufacture businesses.

Each prospective business should carry a compact economic contract:

```
BUSINESS_ID
OFFER
TARGET_BUYER
DEMAND_EVIDENCE
ACQUISITION_SURFACE
PRICE
FULFILLMENT
COST_CAP
AUTHORITY_SCOPE
TRUTH_REQUIREMENTS
KILL_CONDITION
```

Digital Proxy = executive interface at the **exception boundary**, not unrestricted autonomous CEO.

Allowed machine asks:

- “This specific business passed its economic gates. This specific external action is authorized under policy. Approve this irreversible permission?”

Forbidden machine asks:

- “Should I post this random thing?”
- Treating credential presence as outreach authorization

Autonomy is **earned** by repeated verified pathways under governance — not assumed.

---

## Agent rules for this requirement

1. Do not invent product, engine, database, dispatcher, swarm, or architecture for this frontier.
2. Do not request, accept, store, or log `DISCORD_WEBHOOK`.
3. Do not treat secret install alone as authorization to publish.
4. Do not claim revenue, external publication, visitor exposure, or buyer existence without the evidence fields above.
5. Do not invent buyer, prospect, or demand context.
6. Prefer CMD-DIAG-29; do not promote QUOTE-COMPARE-49 until cold checkout passes.
7. After an actually authorized publication succeeds: update this file, repo-root copy, Notion B04 / Spike 191 / Production Surface Map with message ID, channel ID, timestamp, offer, EXTERNAL_SENT.
8. Bridge coordinates work state; Stripe + settlement + fulfillment + independent proof remain the only economic truth.

---

## Cross-references

- Notion: Agent Ridge Index, Concrete Blocker B04 (Rank 1), Spike 191, Production Surface “External-Dispatch Route”
- Protocol: `AGENT_BUS/BRIDGE/PROTOCOL.md`
- Root copy: `agent-bridge-requirement.md`
- Workflow: `.github/workflows/acquire-catalog-discord.yml`
- Offer: `OFFER-CMD-DIAG-29-NZD` / Commander Deck Diagnostic NZ$29

---

*Updated 2026-10-06. Credential ≠ authorization. Fail-closed. No revenue claimed. No invented demand.*


---

## Shared Multi-LLM Synchronization Contract (2026-10-09)

**Purpose:** one North Star across the owner's phone LLMs, spouse's phone LLMs, local LM Studio, cloud agents, and any future collaborators explicitly invited by the owner. A device or model is an execution node, not a separate project or source of truth.

### Canonical shared handoff envelope

Every task handoff MUST identify:

```yaml
task_id: "<stable task identifier>"
north_star: "DreamLedger / BrownEye Cortex shared portfolio"
objective: "<specific outcome>"
owner_node: "<model, device, or human collaborator>"
status: "UNCLAIMED | CLAIMED | BLOCKED | REVIEW | COMPLETE"
target_paths: []
base_commit_sha: "<exact starting commit>"
branch: "<branch name>"
commit_sha: "<resulting commit, when available>"
input_artifacts:
  - uri: "<durable link>"
    sha256: "<hash, if applicable>"
output_artifacts:
  - uri: "<durable link>"
    sha256: "<hash, if applicable>"
tests:
  - name: "<test>"
    result: "PASS | FAIL | NOT_RUN"
truth_label: "VERIFIED | UNVERIFIED | CONTRADICTED | STALE | TEST | SIMULATED | INTERNAL | UNMATCHED"
blocker: null
next_owner: "<next responsible node>"
updated_at: "<UTC timestamp>"
```

If a node cannot write this structure to a supported runtime, it must publish an equivalent Markdown handoff linked from the shared issue or project brief. Never claim synchronization merely because two models were prompted with similar text.

### Coordination and conflict rules

1. **Claim before write.** Register task ownership and target paths before editing. One active writer per target path; other nodes review or work on disjoint paths.
2. **Commit-aware handoff.** Record the exact base commit. Before applying work, check whether the target changed. Inspect diffs and reconcile; never overwrite newer work from a stale checkout.
3. **One durable project state.** GitHub stores source, specs, tests and commits; Notion stores the readable North Star and decisions; Airtable mirrors portfolio/registry status. Link artifacts across systems rather than creating competing truths.
4. **Heterogeneous nodes.** LM Studio is optional local acceleration; cloud execution continues if the desktop is offline. Phone models may research, triage, plan, review and draft. They may claim code/runtime changes only when a verifiable commit or system observation exists.
5. **Future collaborators.** Friends join only if the owner explicitly chooses to invite them. Give each person an individual identity and least-privilege access. Do not share accounts or secrets. Review access before granting write, deploy, billing or payment permissions.
6. **Credential hygiene.** Never place API keys, webhook URLs, private signing keys, payment credentials, or sensitive personal data in model prompts, GitHub issues, Notion, or Airtable. Use approved secret stores and scoped credentials.
7. **Authority membrane.** Models do not independently authorize external outreach, spending, payments, account changes, secret access, or irreversible production actions. Existing human and policy gates remain mandatory.
8. **Evidence resolves disagreement.** Treat model output as a proposal until source inspection, tests, and system-of-record checks support it. Resolve conflicts using evidence, tests, canonical commits, and economic observation, not model seniority.
9. **Blockers have owners.** Every blocker needs a concrete next action and next owner. Reuse this Agent Bridge and existing repository workflow; do not create a parallel queue, ledger, or orchestrator.
10. **No false completion.** Task completion, traffic, listings, simulated events, internal dispatch, test payments, and engagement do not count as external revenue.

### Shared portfolio direction

- Quote comparison and document extraction are eligible free, low-friction acquisition utilities. QUOTE-COMPARE-49 is not the privileged funnel.
- Run a broad offer portfolio with explicit ownership, test results, cost boundaries and kill conditions.
- MTG remains the master/reference silo. Music & Media should reuse its listing lifecycle and add vinyl metadata plus fair, auditable auctions. FightEdge should use the canonical silo contract while retaining sports-specific domain logic.
- Preserve idempotent payment handling, durable-before-acknowledgement, settlement-to-fulfillment evidence, receipt integrity, and existing authorization boundaries.
- Engagement features must be transparent and user-controlled: no deceptive scarcity, punitive streak loss, or compulsive variable-reward traps. Auction timing, bid caps, rules, and notifications must be clear.
- `VERIFIED_EXTERNAL_REVENUE = NZ$0.00` until independent external settlement and fulfillment/delivery evidence are verified.

### Synchronization protocol

`CLAIM → READ NORTH STAR + CURRENT COMMIT → WORK IN SCOPED PATHS → TEST → PUBLISH COMMIT/ARTIFACT + HASH → UPDATE HANDOFF → NEXT NODE REVIEWS → AUTHORIZED MERGE/DEPLOY → VERIFY EXTERNAL RESULT`

**Important status boundary:** this document defines a collaboration contract. It does not by itself prove that all phone apps, LM Studio, Notion, Airtable, or cloud agents are technically connected to a live shared runtime. Each integration must be independently wired and observed before claiming automatic cross-device synchronization.
