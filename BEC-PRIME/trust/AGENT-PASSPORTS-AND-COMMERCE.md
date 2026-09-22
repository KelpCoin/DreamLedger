# Agent passports, agentic commerce, and the DreamLedger trust wedge

**On disk for multi-LLM continuity. Not a claim of live KYC product.**

---

## Why “Ledger” matters

dreamledger.org is positioned as a place where **commercial and agentic facts can be recorded with evidence**—offers, settlements, fossils, entitlements—not only a storefront skin.

The **trust wedge**: strangers (human or agent) need a reason to transact. A ledger-shaped surface answers:

1. Who is acting? (identity)  
2. Under what mandate? (delegation / spend scope)  
3. What actually settled? (payment + fulfilment proof)  
4. What is the track record? (reputation—still the weakest industry layer)

Industry framing (“Know Your Agent”) matches this: identity, authorization to spend, accountability/revocation—not session cookies alone.

---

## Landscape (2026) — map, don’t invent a new global standard

| Layer | Examples | Role |
|-------|----------|------|
| Agent ↔ tools | **MCP** | Capabilities |
| Agent ↔ agent | **A2A** + **Agent Cards** | Discovery / tasks |
| Checkout journey | **ACP**, **UCP** | Discover → cart → pay |
| Payment authority | **AP2**, Visa TAP, Mastercard Agent Pay / Verifiable Intent | Scoped human mandate |
| Machine pay | **x402**, **MPP** | Agent-native rails |
| Org / legal | **vLEI**-style org trust, LCP (terms/recourse) | Who stands behind the agent |
| “Passport” products | Workday Agent Passport (enterprise safety), open agent-passport stacks (keys + attestation), on-chain KYA experiments | Issue/verify agent credentials |

DreamLedger does **not** need to reimplement Visa/Mastercard. It needs a **merchant-side trust posture** and optional **passport-shaped records** that compose with the above.

---

## DreamLedger Agent Passport (design target)

A **passport** here is a durable, machine-readable credential *about an actor* on this ledger—not a travel document meme.

### Passport classes

| Class | Holder | Purpose |
|-------|--------|---------|
| `human_buyer` | Verified checkout identity (email/session) | Entitlements, wall keys |
| `merchant_face` | dreamledger.org / silo | Signed offer catalog pointer |
| `commerce_agent` | External agent buying or quoting | Scoped browse/buy with mandate refs |
| `play_agent` | In-shard AI cohort (see Phin Haven doc) | Non-commercial presence; labeled AI |
| `ops_agent` | Internal BEC worker | Bus jobs only; no public spend |

### Minimal passport fields (v0)

```json
{
  "passport_id": "pp_…",
  "class": "commerce_agent",
  "public_key_or_did": null,
  "display_name": "…",
  "issued_at": "ISO-8601",
  "expires_at": null,
  "scopes": ["catalog:read", "checkout:propose"],
  "mandate_refs": [],
  "reputation": { "settlements_verified": 0, "disputes": 0 },
  "labels": ["agent", "not_human"],
  "policy": "Passport is not verified revenue. Settlements require Stripe live + fossil."
}
```

Store **hashes and public claims** in ledger-facing JSON; private keys never in git.

### Trust wedge on dreamledger.org

| Surface | Trust action |
|---------|--------------|
| `/agent-commerce.json` | Machine offers + fee policy |
| Settlement Sync fossils | Proof of paid sessions |
| Performance Wall cubbies | Proof of digital delivery access |
| Future `/trust` or `.well-known/agent-card.json` | Merchant Agent Card + passport discovery |
| AGENT_BUS | Ops continuity, not customer KYC |

**Wedge sequence (practical):**

1. Human Ball C sale → fossil (prove the ledger works)  
2. Publish merchant Agent Card (A2A-compatible shape) pointing at catalog  
3. Accept **identified** agent browsers with read scopes  
4. Only later: agent-initiated checkout under explicit mandate (AP2-class)—still Stripe for money truth  

---

## Hard rules

1. Passport ≠ payment  
2. Agent label must be honest (no fake “human players” in commerce)  
3. Spend scopes default deny  
4. Reputation only from **dam-accepted** events  
5. Play-lobe AI agents never mint commercial revenue by existing  

See schema: `agent-passport.schema.json`.
