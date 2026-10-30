# Bounded task: free seller calculator
Worker: Codex. Parent: revenue-first execution, 2026-10-30.
Scope: existing seller calculator entrypoints, shared browser calculation, regression tests.
Objective: separate buyer postage from seller cost; reject missing/invalid inputs; deliver a local breakdown without a lead endpoint or unverified paid CTA.
Dependencies: Node built-ins only. No account, provider API, or paid compute.
Acceptance: representative profit/loss, zero denominators, invalid inputs, shipping fee bases, local export, both entrypoints.
Evidence: scripts/test-seller-profit.cjs and docs/work/free-seller-proof.json.
Status: implemented; six regression tests passed. Public release held for owner approval.
