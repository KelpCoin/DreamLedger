# Economic Control Disciplines v1

Status: ACTIVE
Objective: RA_000001
RA_000001 means one genuine stranger voluntarily pays and the payment is independently verified.

## Control families

1. Critical Success Factors
2. KPI / KRI / PI hierarchy
3. Evidence hierarchy E0-E5
4. Evidence provenance
5. Evidence freshness
6. Decision thresholds
7. Experiment integrity
8. Independent payment verification
9. Payment/order/fulfilment reconciliation
10. Accounting invariants
11. Failure taxonomy
12. Fulfilment acceptance criteria
13. Capacity guard
14. Human approval firewall
15. Segregation of duties
16. Observability and audit trail
17. Change control
18. Unit economics
19. Review and refresh

## Pre-RA_000001 operating doctrine

Optimize only for probability, speed, and honest fulfilment of the first verified stranger payment.

E3 is the minimum evidence tier for selecting a first-payment opportunity.
E4 is preferred when available.
E5 is payment evidence and is required to mark RA_000001 VERIFIED.

No clicks, impressions, likes, replies, database records, synthetic payments, internal payments, test payments, projected revenue, or simulated revenue count as RA_000001.

No external outreach is automatic. Human approval is mandatory.

No new architecture is justified by commercial theory alone. Build only when external evidence establishes that the transaction is worth building for.

## Anti-KPIs

Do not optimize candidate_count, job_count, messages_sent, records_processed, pipeline_size, worker_runtime, queue_throughput, AI_generations, or dashboard_activity unless one of them is being used as a diagnostic for a defined KPI.

## Shared control bridge

Supabase is the shared control bridge for GPT-5.6 Luna and Claude.

Read before making consequential commercial claims:
- public.control_registry
- public.control_invariants
- public.control_evidence
- public.control_experiments
- public.control_decisions
- public.ra000001_state
- public.control_bridge_notes
- public.control_dashboard

Use control_bridge_notes for handoffs, findings, warnings, questions, decisions, and agent-to-agent notes.

## Current state

RA_000001: OPEN
Verified payments: 0
Revenue: NZ$0
External outreach: human approval required
Legacy prospecting queue: quarantined by hard reset

## Security note

The pre-existing public.economic_truth_ledger and public.prospecting_candidates tables currently have RLS disabled in Supabase. This is a security finding. Remediation must be reviewed and applied with appropriate policies before exposing those tables through an untrusted client.

Generated: 2026-09-06
