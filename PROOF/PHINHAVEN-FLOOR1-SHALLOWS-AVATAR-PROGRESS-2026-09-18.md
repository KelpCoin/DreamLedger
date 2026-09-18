# PHINHAVEN / Kelplantis progress note

**Date:** 2026-09-18  
**Author context:** continuation from prior agent session (Claude-era notes).  
**Boundary reminder (unchanged):** Kelplantis / PHINHAVEN game activity is **NOT** DreamLedger business revenue. Stripe / real customers / RA_000001 remain a separate track. Nothing in this game work puts money in any account by itself.

## Status of this note

This is an implementation-intent and progress marker written to the canonical repository so progress is visible on disk. It does **not** claim a playable runtime exists, does **not** invent a fixed `appearance` schema, and does **not** claim revenue.

Canonical operating contract still applies: `PHINHAVEN_MASTER_OPERATING_CONTRACT.md` (BLOCKED_PENDING_CANONICAL_RUNTIME until Godot runtime is recovered/reconciled).

## Changes described in the prior session (to be implemented against real code once located)

### 1. Floor 1 rename

- Old leftover name: "The First Garden" (Kelplantis-era).
- New name for Floor 1: **"The Shallows"** (fits Phin Haven naming).
- Scope: display strings / floor labels only. Do not invent Floor 2+ content.

### 2. Safe RPC: linked avatar appearance (own only)

No fixed schema exists yet for `appearance` (open `jsonb` bag; zero real rows to infer from at the time of the prior notes). Therefore:

- Do **not** invent a fake contract and pretend it is real.
- Build the RPC to fetch the **linked avatar's own appearance generically**.
- Never return anyone else's appearance.
- Client must fall back safely if the shape does not match what the renderer expects.

Intended surface (sketch only — implement against live Supabase once the real function names/paths are confirmed):

```sql
-- Pseudocode / intent only. Not applied by this note.
-- Name to be reconciled with existing kelplantis_* RPC family.
CREATE OR REPLACE FUNCTION public.kelplantis_get_own_linked_avatar_appearance(
  p_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid;
  v_appearance jsonb;
BEGIN
  -- Resolve token -> player (existing auth pattern).
  -- Reject if not authenticated / not the owner of the linked avatar.
  -- SELECT appearance FROM the avatar/player row that is linked to this player only.
  -- Return the jsonb bag as-is (or empty object), never another player's data.
  RETURN COALESCE(v_appearance, '{}'::jsonb);
END;
$$;
```

Security requirements (non-negotiable):

- Never expose service-role keys in the browser.
- Do not bypass RLS.
- Own-avatar only.
- Client must treat the result as untrusted shape.

### 3. Client wiring (defensive)

- On link / boot: fetch the own-appearance RPC once.
- Player sprite color / label function made defensive:
  - If a `primary_color` field exists and is a usable value, optionally override sprite color/label.
  - Otherwise fall back to the existing hue system.
- Single declaration; no silent second source of truth.
- If the jsonb shape is missing or unexpected, the existing hue path continues to work.

## Explicit non-claims

- No claim that a Godot / playable client currently lives in this repository in a discoverable form.
- No claim of Floor 2, MMO networking, or broad content.
- No claim of business revenue from game activity.
- No invented fixed appearance schema.

## Next honest steps (aligned with master contract)

1. Locate/recover the actual PHINHAVEN/Godot runtime and reconcile it as canonical.
2. Apply the Floor 1 label rename in the real client/strings once the runtime path is known.
3. Implement the own-only appearance RPC against live Supabase with real RLS/token patterns already used by `kelplantis_*` functions.
4. Wire the client fetch + defensive sprite override.
5. Verify with a test player: linked avatar visible, no cross-player leakage, fallback works when appearance is empty.

## Visibility

This file exists so progress is written to disk (GitHub) and can be seen by other operators without relying on chat history.
