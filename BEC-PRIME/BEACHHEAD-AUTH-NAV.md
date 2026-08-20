# DreamLedger account surface

Canonical website account flow:

- Register: /register.html
- Login: /login.html
- Account: /account.html
- Session: /api/account/me
- Logout: /api/account/logout

The website account is independent of Dreamiez. Authentication is served by the canonical account API and production persistence is handled by the compiled account runtime using Supabase.

Acceptance:

1. Visitor can create an account.
2. Visitor can log in.
3. Session survives navigation through the HttpOnly cookie.
4. /api/account/me reports the authenticated account.
5. /account.html renders the canonical account.
6. User can update display name.
7. User can log out.
