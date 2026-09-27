BATCH 14 BUILD PACK
===================

Purpose
-------
Collapse the current blockers into one reproducible build surface.

Included
--------
Build-All.ps1
  Creates the local Batch 14 operations and proof artifacts.
  Prepares LM Studio and Cloudflare configuration templates.
  Performs no fake payments and no fake revenue.

Verify-All.ps1
  Checks local prerequisites and ports.
  Writes a machine-readable verification artifact.

Apply-Supabase-RLS.ps1
  Uses the Supabase CLI to create a migration enabling RLS on the four
  currently exposed tables.
  It intentionally does not invent application policies.

Economic boundary
-----------------
The following remain zero until independently observed:

VERIFIED_EXTERNAL_REVENUE=NZ$0.00
SETTLED_EXTERNAL_PAYMENTS=0
INDEPENDENT_EXTERNAL_BUYERS=0

MCP economic test
-----------------
The intended final path is:

external client
  -> paid request
  -> payment verification
  -> tool execution
  -> useful result
  -> settlement receipt
  -> reconciliation
  -> verified external outcome

Do not count:
  - self-payments
  - test payments
  - simulated buyers
  - internal transfers
  - marketplace listings
  - wallet balances
  - token emissions
  - generated evidence without external settlement

Human gates
-----------
Public marketplace listing, public outreach, live financial action, and
secrets remain approval-gated.

Excluded
--------
The parcel refund thesis is closed as a primary branch.
The n8n template branch is excluded.
GPU rental is deferred until it demonstrates actual settled cash economics.
