# Performance Wall — default digital fulfilment

## Intent

Buyer pays → receives a **key** → key opens a **cubby** in the wall → collects the digital deliverable → after a **TTL** (default 24h) the cubby **closes**.  
No per-SKU “fulfilment robot arm” required for the majority of catalog.

Specialized arms (billboard allocation, MTG diagnostic engine) remain for products that already have them. **Default = wall.**

---

## Metaphor → machine

| Wall language | System |
|---------------|--------|
| Wall | Fulfilment surface (route + storage) |
| Cubby / slot | One paid grant: `cubby_id` |
| Key | Unguessable token bound to Checkout Session / Payment Intent |
| Open | Authenticated or key-bearing GET that streams or shows deliverable |
| Close | TTL expiry or single-claim policy; row remains for audit |
| Hidden until paid | Cubby contents not public without key |

---

## Lifecycle

```text
1. Stripe Checkout completed (live, paid)
2. Webhook verifies signature + amount + approved offer
3. Wall service mints key + creates cubby (status=OPEN)
4. Buyer redirected or emailed: /wall/claim?key=...
5. Claim: deliver file/text/link; mark CLAIMED (optional multi-claim within TTL)
6. After ttl_hours (default 24): status=SEALED — key no longer opens content
7. Fossil references cubby_id + session_id (revenue path unchanged)
```

**Idempotency:** same `checkout_session_id` → same cubby (no double mint).

---

## Data shape (canonical)

See `performance-wall.schema.json`.

Minimum fields:

- `cubby_id`, `key_hash` (store hash, not raw key at rest if possible)
- `checkout_session_id`, `offer_id`, `silo`
- `payload_ref` (path, URL, or inline small text)
- `opened_at`, `expires_at`, `status` ∈ OPEN | CLAIMED | SEALED | VOID

---

## Security

1. Raw key shown once (success page / email); server stores **hash**  
2. Rate-limit claim endpoint  
3. No directory listing of open cubbies  
4. Webhook signature required before mint  
5. Test mode cubbies never increment verified revenue  

---

## Product policy

| Product class | Fulfilment |
|---------------|------------|
| Digital pack / PDF / text report / download link | **Wall (default)** |
| MTG diagnostic (engine already exists) | Specialized **or** wall wraps report URL |
| Billboard tile | Specialized grid allocation (not a download cubby) |
| Physical | Not wall; not auto-sell until logistics ready |

Registry: set `fulfillment_type: performance_wall` on offers that use this path.

---

## Operator benefit

- One fulfilment pattern for “most things”  
- Webhook stays thin: verify → mint cubby → return  
- Buyer experience is a **key and a door**, not a custom pipeline story  
- 24h seal reduces long-lived public URLs  

---

## Honest limit

The wall does not create demand. It removes friction **after** pay.  
Ball C still requires a stranger to buy.
