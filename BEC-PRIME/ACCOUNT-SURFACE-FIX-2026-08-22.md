# DreamLedger account surface fix

The primary public account contract is:

- `/register` -> `compiled/website/register.html`
- `/login` -> `compiled/website/login.html`
- `/account` -> `compiled/website/account.html`
- `/api/account/register`
- `/api/account/login`
- `/api/account/me`
- `/api/account/logout`
- `/api/account/update`

This change removes the remaining public navigation dependency on the legacy Dreamiez authentication surface, makes the account avatar editor use the primary account API, and repairs the account smoke test so it exercises the actual canonical runtime in local-test mode.

No Stripe, Vercel, Supabase credentials, or external secrets are included.
