# Economic Recovery Register - 2026-10-14

Status: AUDIT / PROPOSED REPAIRS ONLY
Branch: audit/economic-recovery-register-2026-10-14
Economic scoreboard: VERIFIED_EXTERNAL_REVENUE NZ$0.00; settled external payments 0; independent external buyers 0; verified outcomes 0.
No signup, claim, wallet transaction, paid submission, deployment, public post, or secret change was performed by this audit.

## Executive decision

Run two tracks in parallel: verify the cheapest zero-cost bounty opportunity and repair the existing DreamLedger payment-to-fulfillment chain. Do not rebuild the architecture. A bounty is not income until payment is independently observed. A checkout, CI pass, database row, or generated artifact is not revenue.

## Evidence snapshot

| Item | Observed state | Confidence / implication |
|---|---|---|
| DreamLedger branch | main at a03eb3889ea10c94b5ac7ffabfaeafe2547585c8, 2026-10-13 | GitHub connector observation |
| Fulfillment contract | docs/FORENSIC-FULFILLMENT-ACCEPTANCE.md defines ten gates and the canonical zero scoreboard | Existing control; preserve |
| Frantic board | Public README reports day 94 and five open bounties; last ledger entries dated 2026-10-13 | Active board corroborated, but exact #130 price/gate not independently fetched |
| Frantic API | Direct web-reader fetch of https://gofrantic.com/v1/board failed in this audit | Exact live rows UNVERIFIED; local read-only curl required |
| DeskCrew descriptor | Updated 2026-10-12; 1 open bounty worth $1, $0.06 attempt cost, 85% worker share, 21% historical acceptance, 82 paid / $68.89, 29 workers, latest tx hash published | Discovery evidence only; reread before paid action |
| Supabase / Stripe | Earlier project notes report DB/WAL outage, checkout 409, missing/invalid reconciliation secret and incomplete webhook registration | STALE until fresh probes |
| Hosting | Earlier notes report Render build minutes exhausted; README says production serves compiled artifacts | No hosting change until parity and rollback tested |
| GPU | User-reported local three-role model stack; current PC/model availability not independently observed | Optional accelerator, not cloud dependency |
| Revenue | Canonical score remains zero pending independent evidence | No inflation from signups, claims, checkouts, CI, or model output |

## Ten repair tracks

| ID | Blocker | Ten-part solution track | First safe action | Pass evidence | State |
|---|---|---|---|---|---|
| R1 | Stale bounty facts | Fetch JSON; timestamp response; normalize rows; inspect bounty detail; compare mirrored issue; check slots; check gates; check payout rail; hash snapshot; expire after 15 minutes | Local read-only curl | Timestamped board snapshot with exact bounty, gate and slots | READY, not run |
| R2 | Frantic onboarding and token safety | Verify schema; get approval before signup; store token in Credential Manager; never log token; verify email manually; inspect seals; gate public oath; verify chain; confirm wallet before setting payout; poll status read-only | Read docs and board | Eligible status and no token in logs | HOLD: no signup/public actions authorized |
| R3 | Delivery quality | Read criteria; source dated fact from primary registry; verify date; identify relevant thread; check site rules; draft locally; fact-check; remove unsupported claims; human review; submit only after approval | Build draft/evidence packet | Source-linked draft and criteria checklist | READY, not run |
| R4 | DeskCrew EV / fee risk | Read descriptor; preflight; confirm open row; confirm payout network; inspect entrants; calculate EV after 85% share and fee; cap price; set spend cap to NZ$0 until approved; dry-run; reconcile any payout on-chain | Review package and run only free read-only mode | Current row, net EV and chain compatibility | No paid entry |
| R5 | Supabase 503 / WAL | Probe REST and DB; capture timestamps; distinguish dashboard from data plane; stop intake on DB failure; avoid repeated writes; request provider recovery; verify SELECT; test controlled write/read; restore explicit RLS policies; confirm backups | Read-only health checks | REST + DB pass, controlled round trip and no RLS exposure | BLOCKED pending fresh probe/provider |
| R6 | Checkout 409 / metadata | Map offers; pin price IDs; define contract; validate active flag; create session server-side; attach order/offer/fulfillment metadata; use idempotency; validate amount/currency; test success/cancel/expiry; reject inactive offers | Inspect routes/config read-only | Test-mode metadata and contract tests | BLOCKED pending route audit |
| R7 | Webhook / settlement | Register canonical endpoint; verify signature; dedupe event ID; retrieve payment from Stripe; verify paid status; match order; write idempotent ledger; handle refunds; alert unmatched payments; schedule reconciliation as safety net | Audit workflows and webhook code | Replay-safe test, one ledger row and Stripe reconciliation | BLOCKED pending authorized secret setup |
| R8 | Fulfillment / signed evidence | Claim durable job; unique idempotency; lease/expiry; sandbox worker; validate output; generate artifact; hash bytes; sign exact canonical bytes; verify offline; persist delivery evidence | Add tests before runtime changes | Fixture proves signature, hash, order binding, delivery URL and replay safety | Existing spec; implementation proof needed |
| R9 | Heartbeat / GPU coupling | Cloud heartbeat independent of PC; stateless local heartbeat; no secrets in task args; structured status; probe LM Studio; restart once; three-failure circuit breaker; jittered backoff; alerts only after threshold and not after 02:00 NZ; drain inference queue when PC returns | Inspect current task/workflow definitions | Cloud job works with PC off; model checks pass when on; no restart loop | AUDIT NEEDED |
| R10 | Hosting / CI / observability / secrets | Inventory workflows; lint/test before deploy; preserve compiled-site parity; preview deployment; test DNS/TLS; keep rollback; never print secrets; approved secret stores only; structured correlation IDs; proof artifact + verifier per run | Inventory workflows and runs | Green CI, deployed URL parity, rollback test, no secret leakage | No hosting change applied |

## Correct operating order

1. Re-read live Frantic board and DeskCrew descriptor; save raw evidence and timestamps.
2. If a free eligible Frantic bounty is confirmed, prepare a local draft and evidence packet. Public posting, submission, registration, oath/comment, wallet setup and claim require appropriate approval.
3. In parallel, run read-only DreamLedger probes: Supabase data plane, checkout route, webhook evidence, GitHub Actions runs and local LM Studio health.
4. Repair only the first demonstrated blocker. Keep paid offers inactive until checkout metadata, signed webhook, idempotent settlement, fulfillment and reconciliation tests pass.
5. After explicit approval, perform one controlled live transaction. Independently verify payment, fulfillment, signature and ledger reconciliation.
6. Scale unattended acquisition and GPU-assisted drafting only after one complete end-to-end proof.

## Evidence notation

- VERIFIED: independently reproducible evidence exists.
- UNVERIFIED: claim exists but evidence is missing.
- STALE: evidence exceeded its validity window.
- CONTRADICTED: independent observations conflict.
- TEST / SIMULATED / INTERNAL: not external economic truth.
- BLOCKED: a prerequisite prevents the next action.

UNKNOWN is not PASS. A listing, registration, claim, checkout session, unattributed PaymentIntent, CI success or model output is not revenue.

## Next-action table

| Priority | Action | Cost | Authority | Proof artifact |
|---|---|---:|---|---|
| P0 | Fetch Frantic board and DeskCrew descriptor | Free | Read-only | Raw JSON + timestamp + SHA-256 |
| P0 | Inspect GitHub workflow inventory and recent runs | Free | Read-only | Workflow/run snapshot |
| P0 | Probe Supabase and checkout without writes | Free | Read-only | Timestamped status report |
| P1 | Prepare #130 draft only if listing and criteria confirm | Free compute | Local only; no external post | Source-linked draft + checklist |
| P1 | Repair deterministic checkout/webhook tests | Test mode | Branch-only first | Test report + commit SHA |
| P2 | One controlled live transaction | Potentially nonzero | Explicit approval required | Stripe event, settlement, fulfillment, signed receipt |
| P3 | Enable scheduled scale-out and GPU queue | No new spend until measured | After first verified proof | Repeated end-to-end evidence |

## Verifier

This register is documentation only; it does not claim infrastructure was repaired. Verify branch content:
gh api repos/KelpCoin/DreamLedger/contents/docs/ECONOMIC-RECOVERY-REGISTER-2026-10-14.md?ref=audit/economic-recovery-register-2026-10-14 --jq '.sha'

Local verifier:
Select-String -Path .\docs\ECONOMIC-RECOVERY-REGISTER-2026-10-14.md -Pattern '^## Ten repair tracks','^## Correct operating order','^## Evidence notation','^## Verifier'
