# BECK four-cell staging

BECK is staged as four autonomous cells:

1. BECK-LOOP-001: external signal sensor / Polymarket proving ground.
2. BECK-LOOP-002: cross-source event normalization and discrepancy testing.
3. BECK-LOOP-003: external demand evidence radar using existing demand-source primitives.
4. BECK-LOOP-004: self-improving opportunity synthesis across the first three cells.

Execution model:

cloud source collectors -> Supabase evidence/jobs -> garage Windows worker -> LM Studio localhost -> Supabase result/evidence -> next cycle.

The phone is not an execution dependency.

Safety:

- Default external-action state is disabled.
- cube_cells.kill_state is the hard stop.
- Worker must refuse jobs for non-ACTIVE cells.
- No trading, spending, outreach, publication, or revenue claims in staging.
- External economic claims remain independently verified only.
- Biggie is removed from the normal execution path. Human intervention is reserved for the kill switch and exceptional approval gates.

LM Studio:
- Local endpoint defaults to http://127.0.0.1:1234/v1/chat/completions
- Model is supplied through BECK_LM_MODEL.
- Supabase credentials are environment variables only.
- Never commit credentials.

This branch is staging infrastructure. It is not a production-revenue claim.
