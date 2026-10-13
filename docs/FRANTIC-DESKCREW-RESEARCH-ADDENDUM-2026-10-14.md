# External Acquisition Addendum - 2026-10-14

Status: READ-ONLY RESEARCH. No registration, claim, public post, wallet change, or paid action performed.

## Frantic #130: material eligibility blocker

Public issue https://github.com/auscaster/frantic-board/issues/472 reports that a previous #130 claim expired after the brief was corrected. The corrected contract reportedly requires the operator's own Reddit account to be at least 90 days old with at least 100 comment karma, and requires the operator to post the answer personally and submit permalinks. The issue says the previous draft-queue interpretation was wrong and that the drafts were rated strong, but no compliant public delivery was accepted.

Decision: do not assume #130 is email-only or immediately claimable. Before signup/claim, read the exact live bounty detail and confirm:
- current claim slots and claim action state;
- current gate and required artifacts;
- whether a qualifying Reddit identity exists and is authorized;
- whether posting from that identity is permitted and approved;
- delivery deadline and revision rules.

The GPU can research, source, fact-check and draft. It cannot substitute for the required aged Reddit identity or perform a public post without authorization. If the identity requirement cannot be met, classify #130 as BLOCKED, not as near-certain $3 revenue.

## Frantic board consistency

The public repository README currently reports five open bounties and a ledger total around $1,302.85 moved, while the public homepage search snapshot said the visible board was empty and displayed total settled $0. These observations may reflect different rendering/cache or data scopes; treat them as CONTRADICTED until the live API and receipt ledger are fetched directly and reconciled.

The README itself states that gofrantic.com is the source of truth and the GitHub repository is a mirror. Do not infer the current #128/#129/#130/#127 price, slots, or gate from old copied text.

## DeskCrew: promising discovery, but not risk-free

Public descriptor https://deskcrew.io/.well-known/x402 was updated 2026-10-12. It reported one open $1 bounty, $0.06 attempt cost, 85% worker share, and 21% historical acceptance. Using the conservative published terms, expected gross worker payout per attempt is 1.00 * 0.85 * 0.21 = $0.1785, so expected value before any other costs is $0.1185 after the $0.06 fee. This is an estimate based on historical aggregate approval, not a promise; contesting, entrant count, eligibility, and answer quality can lower the actual chance of winning.

Current recommendation:
1. Re-read the descriptor and board immediately before any attempt.
2. Prefer free list/preflight/context-independent discovery first.
3. Use the free dry-run mode and inspect the package before execution.
4. Do not use --live or provide WALLET_KEY until Biggie explicitly approves a spending ceiling and confirms the wallet/network.
5. If there is no currently open eligible bounty, spend nothing.

## Next evidence needed

- Raw Frantic API JSON with timestamp, HTTP status and SHA-256.
- Exact bounty detail JSON for each candidate.
- DeskCrew descriptor and live board snapshot captured in the same run.
- For any eventual payout, independent chain receipt plus a match to the agent/claim and fulfilled work.

## Verifier

Open this document and the source issue. Confirm the status is still READ-ONLY and that no claim/public action is reported as completed:
https://github.com/KelpCoin/DreamLedger/blob/audit/economic-recovery-register-2026-10-14/docs/FRANTIC-DESKCREW-RESEARCH-ADDENDUM-2026-10-14.md
