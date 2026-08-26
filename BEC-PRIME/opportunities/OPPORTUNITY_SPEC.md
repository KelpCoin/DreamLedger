# Economic Opportunity Compiler

Purpose: turn monetizable hypotheses into ranked, testable economic missions without confusing a hypothesis with evidence.

Required fields:
- opportunity_id
- silo
- title
- hypothesis
- channels
- buyer
- offer
- price_nzd
- test_cost_nzd
- upside_nzd
- evidence_required
- smallest_test
- execution_steps
- proof_required
- risk
- public_action

Rules:
1. Evidence status is UNKNOWN unless a proof artifact explicitly establishes it.
2. The compiler ranks opportunities but does not claim revenue.
3. The smallest test should seek a real economic event with minimal spend.
4. Public actions remain approval-gated by the control plane.
5. MTG and adult/Amplissa concerns must remain isolated. This registry contains no adult opportunities.
6. Channels are adapters. No single marketplace is treated as the business.
