# Agent Bridge Requirement — First Dollar External Distribution

**Status:** ACTIVE · MACHINE-READABLE · 2026-10-06  
**Location:** `agent-bridge-requirement.md` (repo root) · also `AGENT_BUS/BRIDGE/agent-bridge-requirement.md`  
**Related:** Notion Agent Ridge (Governance & Safeguards), Blocker B04 Rank 1, Spike 191

---

## FIRST_DOLLAR_STATUS

```
FIRST_DOLLAR_STATUS: BLOCKED_AT_EXTERNAL_DISTRIBUTION
BLOCKED_AT: DISCORD_CREDENTIAL_BOUNDARY
CURRENT_STATE: AUTHORIZED → GAUNTLET_PASS → EXTERNAL_DISPATCH_BLOCKED
```

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
   Gauntlet emits `OFFER-CMD-DIAG-29-NZD`.  
   Acquisition workflow now checks `proof.approved_offer_ids.includes('OFFER-CMD-DIAG-29-NZD')` (was incorrectly checking `CMD-DIAG-29`).

3. **Workflow reaches the external-action boundary.**  
   Then fails on:
   ```bash
   test -n "$DISCORD_WEBHOOK"
   # exits code 1 — secret is empty
   ```

4. **No external POST has occurred.**  
   No Discord message ID, no channel ID, no external-send evidence.

5. **CMD-DIAG-29 commerce rail is live and preferred.**  
   - Offer: Commander Deck Diagnostic  
   - Price: NZ$29  
   - Stripe live link: `https://buy.stripe.com/eVqeVdc1T01n1DV3gwdwc30`  
   - Public `/mtg` surface live; offers feed marks CMD-DIAG-29 as `VERIFIED_AVAILABLE`  
   - Cold-tested live payment form (no purchase submitted)  
   - QUOTE-COMPARE-49 not used as first path (prior Stripe link cold-fail)

6. **Render healthy** for this frontier (DreamLedger1 + dreamledger-silo-gateway live).

7. **Supabase remains UNOBSERVABLE** (IPv6 ECONNREFUSED). Observation gap only — not the first-dollar blocker.

---

## Exact blocker

| Field | Value |
|-------|--------|
| Component | `.github/workflows/acquire-catalog-discord.yml` |
| Job / step | `post` → Publish selected approved offer and verify |
| Failure | `DISCORD_WEBHOOK` environment variable is empty at runtime |
| Required change | Configure GitHub Actions **repository secret** `DISCORD_WEBHOOK` with the already-authorized Discord acquisition webhook |
| Code change required | **None** |
| New dispatcher / product / architecture | **None** |

---

## Owner action only (HUMAN_MINUTES: <2)

```
KelpCoin/DreamLedger
  → Settings
  → Secrets and variables
  → Actions
  → Repository secrets
  → New repository secret

Name:  DISCORD_WEBHOOK
Value: <the already-authorized Discord acquisition webhook for the configured destination>
```

**Do not paste the webhook value into chat, issues, PRs, agent context, or this file.**

After the secret is set, re-run the existing approved acquisition workflow. It performs its own checks and read-back verification.

---

## Evidence required for next state

```
EXTERNAL_PUBLICATION = VERIFIED_DISCORD_MESSAGE
```

Must include:
- Discord message ID
- Channel ID
- Read-back containing the live CMD-DIAG-29 payment link

Only then:

```
NEXT_ECONOMIC_STATE: EXTERNAL_SENT
```

A subsequent independent buyer payment moves the frontier to settlement → fulfillment → independent proof.  
**Scoreboard remains NZ$0.00 until those events actually occur.**

---

## Economic scoreboard (frozen until evidence)

```
VERIFIED_EXTERNAL_REVENUE:     NZ$0.00
SETTLED_EXTERNAL_PAYMENTS:     0 qualifying
INDEPENDENT_EXTERNAL_BUYERS:   0
PAID_FULFILLED_ORDERS:         0
```

Historical Stripe PaymentIntents with empty metadata are **not** attributed to this experiment.

---

## Fallback

None needed yet. Existing **CMD-DIAG-29** rail is viable once the credential boundary is supplied.

---

## Agent rules for this requirement

1. Do not invent a new product, engine, database, dispatcher, swarm, or architecture for this frontier.
2. Do not request, accept, store, or log the `DISCORD_WEBHOOK` value.
3. Do not claim revenue, external publication, or buyer existence without the evidence fields above.
4. Prefer CMD-DIAG-29 over other offers for the first external publication.
5. After secret install + successful workflow: update this file, `AGENT_BUS/BRIDGE/agent-bridge-requirement.md`, Notion Blocker B04, Spike 191, and Production Surface Map with message ID / channel ID / EXTERNAL_SENT.
6. Bridge coordinates work state; Stripe + settlement path remain the only economic truth.

---

## Cross-references

- Notion: Agent Ridge Index, Concrete Blocker B04 (Rank 1), Spike 191, Production Surface “External-Dispatch Route”
- Protocol: `AGENT_BUS/BRIDGE/PROTOCOL.md`
- Bridge copy: `AGENT_BUS/BRIDGE/agent-bridge-requirement.md`
- Workflow: `.github/workflows/acquire-catalog-discord.yml`
- Offer: `OFFER-CMD-DIAG-29-NZD` / Commander Deck Diagnostic NZ$29

---

*Written 2026-10-06 from production Run #8 inspection. Fail-closed. No revenue claimed.*
