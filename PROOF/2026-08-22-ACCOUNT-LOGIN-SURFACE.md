# DreamLedger account/login surface proof

Date: 2026-08-22

Canonical account endpoints present in main:

- POST /api/account/register
- POST /api/account/login
- GET /api/account/me
- POST /api/account/logout
- POST /api/account/update

Canonical account pages present in compiled website:

- /register.html
- /login.html
- /account.html

The account API is exposed through api/account/[...route].js and delegates to the canonical account runtime. Production persistence uses Supabase; local file storage is restricted to deterministic CI smoke tests.

The login and registration pages already perform a session-retention check against /api/account/me before redirecting.

This repository proof establishes source-level account wiring only. It does not claim that the currently deployed public domain has been successfully exercised.
