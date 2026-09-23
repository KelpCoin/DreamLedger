# DreamLedger Knowledge Lake

Cloud bootstrap from a PC:

powershell -ExecutionPolicy Bypass -File .\scripts\knowledge-lake\Bootstrap-DreamLedgerLake.ps1

Required environment variables:

SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret>

Never commit the service-role key. It belongs in the local environment or secret manager.

The bootstrap creates:

C:\DreamLedger_Actual\knowledge-lake\fossils.ndjson
C:\DreamLedger_Actual\knowledge-lake\sync-manifest.json
