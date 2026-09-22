# Client connection failure contract

## MUST

- Probe backend before presenting login as the only UI  
- Surface network / auth / schema errors in plain language  
- Offer retry  
- Log error code to console for operator  

## MUST NOT

- Hang on login with no message when Supabase is unreachable  
- Assume table name `client_builds` without migration note  
- Claim “synced” when probe failed  

## Canonical table name (2026-09 rebrand)

`phinhaven_client_builds`
