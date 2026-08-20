# DreamLedger account contract

DreamLedger is the primary account namespace.

Canonical routes:
- /login.html
- /register.html
- /account.html
- /signin.html -> /login.html
- /signup.html -> /register.html
- /dreamiez/login.html -> /login.html
- /dreamiez/register.html -> /register.html

Dreamiez is optional and free. It is not required for account creation, login, browsing, purchasing, or account management.

API contract:
- POST /api/account/register
- POST /api/account/login
- POST /api/account/logout
- GET /api/account/me
- POST /api/account/update

A successful login or registration must establish the DreamLedger account session and return /account.html as the next destination. A failed storage dependency must return a visible error rather than a false successful login.
