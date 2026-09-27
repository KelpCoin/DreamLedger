# Silo Factory Cloud Orchestration Contract

Date: 2026-09-27

Canonical production source of truth:
- Supabase project: wbwgroygjeyukkspnqiy
- Registry: public.economic_silo_registry
- Factory: public.silo_factory_batches
- Agent runs: public.silo_agent_runs

Deployed functions:
- silo-factory v1
- silo-orchestrator v2
- elohim-cube v6
- gauntlet-cube v4
- truth-oracle-execute v9

Flow:
CANDIDATE -> Elohim proposal -> Gauntlet adversarial gate -> QUALIFIED only on PASS.
SELLABLE, ACTIVE, and VERIFIED remain downstream gates.
Truth Oracle remains the independent economic verification authority.

Safety:
- Candidate registry rows remain HIDDEN.
- Elohim proposals set price_nzd=0 until a real bounded commercial proposition is established.
- External action remains false.
- Human approval remains required.
- No registry row is promoted to verified revenue by infrastructure activity.
- Verified revenue, settled payments, and independent buyers remain zero until independently evidenced.

Scale target:
500000 addressable registry capacity. Current materialized candidates: 5000.
