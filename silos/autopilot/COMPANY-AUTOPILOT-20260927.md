# Company Autopilot v1 - 2026-09-27

Purpose
- Run the economic organism continuously toward its first VERIFIED external revenue.
- Keep registry capacity bounded at the existing 5,000 candidate population.
- Keep external side effects behind the existing human-approval boundary.
- Reconcile real commerce state on every cycle.

Architecture
1. Supabase cron job company-autopilot-5m runs every five minutes.
2. company-autopilot authenticates through the existing economic_activation_auth token hash.
3. It records durable run/state telemetry in company_autopilot_runs and company_autopilot_state.
4. It invokes silo-orchestrator with a hard batch of 5 candidates.
5. It invokes commerce-supervisor to reconcile paid and fulfilled orders.
6. Existing economic-activation continues independently on its one-minute schedule.
7. Truth Oracle and economic proof loops remain authoritative for VERIFIED truth.

Current boundary
- Registry expansion: disabled.
- Advertising/spend: disabled.
- External outreach execution: approval-gated.
- Fake revenue/buyers/payments: forbidden.
- VERIFIED_EXTERNAL_REVENUE remains the only revenue truth.

Current observed state at deployment
- Commerce cells: 7.
- Sellable + acquisition-ready cells: 2.
- Verified external revenue: NZ$0.
- Registry: 5,000 candidates.
- Initial qualification test exposed and repaired an Elohim authentication path and then exposed a Gauntlet verdict-schema mismatch. No candidate has been counted QUALIFIED from those runs.

Polsia-derived operating pattern
- Persistent objective.
- Specialized execution organs.
- Scheduled autonomous cycles.
- Durable activity/state.
- Self-monitoring and recovery.
- Human authority at irreversible external boundaries.

This is an implementation of the operating pattern using DreamLedger infrastructure, not a copy of Polsia's proprietary software.
