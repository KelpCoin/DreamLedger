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
