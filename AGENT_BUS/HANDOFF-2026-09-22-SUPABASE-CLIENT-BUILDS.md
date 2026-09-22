# HANDOFF — Supabase client builds / silent login

## Claude session truth

- Sandbox cannot reach operator Supabase  
- Hosted Claude page also cannot fix outbound Supabase  
- Table renamed to **phinhaven_client_builds** (not deleted)  
- Fix: client must show connection failure loudly  

## Grok session truth

- Same: no live Supabase connector  
- Wrote docs to GitHub only  

## Disk

- `docs/play/SUPABASE-CLIENT-BUILDS-STATUS.md`  
- `docs/play/CLIENT-CONNECTION-FAILURE-CONTRACT.md`  

## Operator next

SQL/Storage recover latest build → commit client to git → probe-before-login UX.
