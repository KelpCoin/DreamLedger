Account surface hardening is tracked in the canonical compiled website.

Required public flow:
/register -> POST /api/account/register -> GET /api/account/me -> /account
/login -> POST /api/account/login -> GET /api/account/me -> /account
/account -> GET /api/account/me, otherwise redirect to /login

Production account persistence is Supabase-backed through the canonical account runtime.