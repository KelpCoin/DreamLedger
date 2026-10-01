# DreamMeez identity authorization boundary

Status: CURRENT DECISION

## Decision

DreamLedger uses Option C for the canonical DreamMeez identity chain at this stage:

- `__Host-dreamiez_session` is the application authentication credential.
- The server verifies its HMAC signature before trusting the account id.
- The server resolves that account id through `dreamledger_accounts` on every request.
- Avatar and Kelplantis identity routes enforce ownership in application code.
- Supabase `service_role` is never an end-user authorization mechanism.
- Direct PostgREST authorization is not claimed as a security boundary for this custom-session identity model.

This decision is deliberately scoped to the current architecture. It does not prohibit a later migration to Supabase Auth or a short-lived custom JWT.

## Why Option C now

The canonical account authority is `public.dreamledger_accounts(id)`, whose id is text. The application currently authenticates through a custom signed session rather than Supabase Auth. Therefore `auth.uid()` is not the identity primitive for these routes, and introducing `auth.uid()` policies without changing the identity authority would create a false security signal.

The immediate acceptance target is end-to-end application authorization. A future database-level RLS boundary can be introduced only after an explicit identity migration to either Supabase Auth or a JWT claim that Postgres can evaluate.

## Required authorization proof

The staging authorization verifier must prove all of the following with two independently seeded test accounts and valid signed session cookies:

1. User A reads only A's avatar.
2. User B reads only B's avatar.
3. User A cannot read B's avatar by changing an id or request parameter.
4. User A cannot modify B's avatar.
5. User A cannot equip an item owned only by B.
6. User A cannot bind A's Kelplantis identity to B's avatar.
7. User A cannot read B's Kelplantis state through the identity route.
8. A tampered session cookie becomes anonymous/unauthorized and never selects the supplied account id.

These are application-layer tests. A service-role client must not be used for these assertions.

## Database defense in depth

RLS remains enabled on canonical identity tables where already configured, and direct client grants remain revoked. That blocks ordinary direct client access by default, but it is not presented as owner-aware RLS until the database has a usable user identity claim.

The Kelplantis composite relationship is authoritative at the schema level:

`kelplantis_players(account_id, avatar_id)` must reference `dreammeez_avatars(account_id, avatar_id)`.

Nullable legacy/unbound rows remain allowed until they are deliberately migrated. A partially populated `(account_id, avatar_id)` pair is not treated as a valid bound identity.

## Promotion gate

Do not switch the authorization boundary or deploy production schema changes as part of this pass. Promotion requires:

`repository CI PASS -> staging migration -> structural verifier PASS -> application authorization verifier PASS -> session tamper tests PASS -> version fencing PASS -> evidence sealed -> explicit human approval`

A later move to Option A or B is a separate architecture/security change and requires its own migration and verifier.
