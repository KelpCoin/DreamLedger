# Gauntlet + Digital Proxy: Owner-Bottleneck Removal Canon

Date: 2026-10-10
Status: Proposed canonical policy; runtime enforcement NOT YET VERIFIED.

## North Star
Humans set goals and approve bounded, revocable policy envelopes. Agents execute routine work inside those boundaries. The Gauntlet evaluates each proposed action. The Digital Proxy executes only the exact action that passes. Independent observers verify the external result.

## Canonical rule
Pre-authorize the policy, not each routine action. Do not ask Biggie or Peggy to approve every routine post, retry, or low-risk action that is explicitly inside an installed and tested authorization envelope. This rule is not blanket permission. Until an envelope is explicitly approved, installed, and runtime-tested, existing approval gates remain in force.

## Roles
- Owner: sets project/silo, exact destination accounts, allowed action types, content boundaries, schedule, frequency limits, spend ceiling, expiry, stop conditions and revocation path.
- CUBE/production workers: research, draft, generate variants and prepare assets; cannot grant themselves permissions.
- Gauntlet: evaluate the exact payload and destination against the active envelope, evidence, factual claims, rights/licensing, privacy, platform rules, silo boundaries and limits. Emit a durable PASS/DENY receipt bound to policy version and payload hash.
- Digital Proxy: execute only the exact payload and destination bound to a valid PASS and active authorization. Record provider response and separately observe the external result. Never silently alter the payload after evaluation.
- Elohim/recovery workers: repair failures and resubmit; cannot bypass DENY or widen authority.
- Independent observers: establish what actually happened. PASS, dispatch, API acceptance or HTTP 200 is not proof of publication, buyer response, settled payment, fulfillment or delivery.

## Explicit public posting delegation
Routine public posting may occur without per-post approval only after an authorization envelope has been explicitly approved, installed and runtime-tested. It must name allowlisted accounts and destinations; permitted post types and prohibited claims/topics; content provenance and rights; disclosure, privacy and platform checks; duplicate detection; frequency limits; scheduling window; spend ceiling (NZ$0 by default); expiry; audit retention; emergency stop; and rollback where available.

If all checks pass, the Digital Proxy may publish automatically within that envelope. If a check fails or the action is outside scope, hold it and request only the missing decision. New accounts/destinations, unapproved campaigns, unsupported claims, spending above the cap, identity/KYC/payout changes, secret/access grants, legal commitments, irreversible data changes and material ambiguity remain human-gated. No spam, unsolicited bulk messages, fake engagement, fabricated testimonials or cross-silo leakage.

## Approval tiers
- Tier 0: internal reversible research, drafts, tests, builds, deduplication and bounded retries; autonomous within least privilege.
- Tier 1: named, pre-authorized external actions to allowlisted destinations; autonomous only after the envelope is active and runtime-tested.
- Tier 2: new destinations, unapproved campaigns, excess spend, account/identity changes, secrets/access grants, legal commitments or irreversible changes; human decision required.
- Tier 3: suspected credential exposure, silo breach, unauthorized action, material incident or gate bypass; stop and alert.

## Execution contract
Read the North Star, relevant project instructions and current state. Claim one scoped task; inspect the real blocker; execute the highest-value authorized work; test; save durable artifacts and verification; update the existing backlog/handoff; then continue to the next independent task. Reuse existing Gauntlet, Digital Proxy, Agent Bridge, authorization and evidence components. Do not create a parallel queue, ledger, orchestrator or truth system. For blockers, attempt safe independent recovery, identify viable routes, and execute the best already-authorized route. Escalate only decisions that cannot be made within policy.

Each task receipt should include task ID, silo, policy version, destination/target paths, base commit, payload hash, artifact references, tests, Gauntlet result, execution result, independently observed result, truth label, blocker, next owner and timestamp. Keep secrets and sensitive personal data out of logs.

## Runtime rollout
1. Locate actual Gauntlet and Digital Proxy entry points and current tests.
2. Extend existing code with envelope validation, exact-payload binding, allowlists, limits, expiry/revocation, idempotency and durable receipts.
3. Test pass/deny, expired/revoked authorization, changed payload, wrong silo, unknown destination, duplicate request, timeout/retry, provider rejection and observed-result mismatch.
4. Dry-run representative tasks and prove no external action occurs.
5. Enable one narrow allowlisted action only after explicit envelope approval and passing runtime tests.
6. Expand incrementally with audit evidence and an emergency kill switch.
7. Report separate states: POLICY_DOCUMENTED, POLICY_INSTALLED, RUNTIME_TESTED, ACTION_DISPATCHED, EXTERNAL_RESULT_OBSERVED.

## Owner-bottleneck metrics
Track owner interruptions per 100 routine tasks, autonomous completion rate within policy, gate error rate, recovery success, unauthorized actions (target zero), external-result observation rate and human minutes per verified economic outcome.

## Cross-project applicability
Apply this contract across BrownEye Cortex, DreamLedger, BECK and other explicitly connected project silos. Preserve hard brand/data boundaries and existing canonical infrastructure. This file records policy only; it does not certify that runtime controls are implemented or passing tests.
