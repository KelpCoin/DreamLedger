# Phin Haven client builds + Supabase connectivity status

**Date:** 2026-09-22  
**Source:** Operator / Claude session diagnosis + multi-LLM continuity

---

## What Claude confirmed

1. **Sandbox / hosted Claude page cannot reach** the operator’s Supabase project (outbound to arbitrary external APIs blocked or unavailable).  
2. Publishing as a hosted page does **not** fix that — same class of problem.  
3. **Fix must be in the client file itself:** connection failure must be **impossible to miss**, not a silent stuck login screen.  
4. Local agent files may have been wiped; last known-good client should be recovered from Supabase storage/table where possible.  
5. Table was **renamed**, not deleted: **`phinhaven_client_builds`** (Phin Haven rebrand), previously something like a generic `client_builds` name.

---

## What this Grok session can / cannot do

| Capability | Status |
|------------|--------|
| GitHub writes to DreamLedger | Yes |
| Live Supabase REST/SQL to project `wbwgroygjeyukkspnqiy` (or current) | **No** — no Supabase connector in this session |
| Verify row contents of `phinhaven_client_builds` | Operator or Supabase-capable agent only |

Do not assume silent success from chat agents that cannot open the DB.

---

## Required UX: connection failure visibility

Any Phin Haven / DreamLedger client that depends on Supabase **must**:

1. On startup, probe a cheap endpoint (e.g. health, or `select` limit 1 on a public/config row).  
2. If network/CORS/auth/timeout fails → **full-screen or modal error**, not login form alone.  
3. Show: error class (network / 401 / 404 table / RLS / timeout), timestamp, project ref if safe, “retry” button.  
4. Never leave the user on an empty login with no explanation.  

Pseudo-flow:

```text
boot → probe Supabase
  ok → login / session restore
  fail → ERROR SURFACE (not login)
```

---

## Table: `phinhaven_client_builds`

| Item | Note |
|------|------|
| Name | `phinhaven_client_builds` |
| Role | Store / version client build artifacts or metadata after rebrand |
| Risk | Code still querying old table name → 404/empty → looks like “login broken” |
| Action | Grep all clients for old `client_builds` / Kelplantis names; point at new table |

Operator: confirm columns and latest row in Supabase SQL editor.

---

## Recovery steps (operator)

1. Supabase SQL: `select * from phinhaven_client_builds order by created_at desc limit 5;` (adjust columns).  
2. If builds are in Storage buckets, list bucket objects for the latest HTML/JS client.  
3. Download last known-good client into git under `phinhaven/` or `public/` so agents are not DB-only.  
4. Ship client with **visible connection error** patch.  
5. Align env: `SUPABASE_URL`, anon key, table name, RLS policies for read of builds if public.

---

## Relation to play design

GOAP / stealth AI / guild docs are **design**. Without a recoverable client + reachable backend, they do not run.  
Money path (Ball C) is independent of this table but shares “don’t silent-fail” discipline.

---

## One sentence

**Table lives as `phinhaven_client_builds`; sandboxed LLMs cannot query it; the client must scream on connection failure instead of fake-login.**
