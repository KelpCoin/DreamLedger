# SUPABASE SECURITY SUBSTRATE AUDIT
## 2026-09-29

The live Supabase advisor reports RLS disabled on seven public tables:

- economic_search_space_config
- economic_search_seeds
- cube_data_lakes
- cube_word_banks
- cube_data_lake_observations
- cube_word_bank_events
- cube_swarm_exchange

The advisor classifies this as critical because anon/authenticated Supabase client roles can access these tables without RLS protection.

No remediation was auto-applied.

Reason: enabling RLS without corresponding policies can block legitimate application access. Policy design must match each table's intended access boundary.

Advisor remediation SQL supplied by Supabase:

ALTER TABLE "public"."economic_search_space_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."economic_search_seeds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cube_data_lakes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cube_word_banks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cube_data_lake_observations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cube_word_bank_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cube_swarm_exchange" ENABLE ROW LEVEL SECURITY;

This is a security substrate issue, not evidence of economic progress or economic failure.

Status:
SECURITY_RISK = CONFIRMED
AUTO_REMEDIATION = NOT_APPLIED
ECONOMIC_SCOREBOARD_EFFECT = NONE

The tables and their access policies must be reviewed before enabling RLS so that the security fix does not create a new production outage.
