# PR 200 Repair Specification

Status: BLOCKED pending evidence
Repository: KelpCoin/DreamLedger
PR: #200
Head: mvp-homepage-2026-08-31
Head SHA: d79dcae8680e75e72e13e153f45bbf8512f51ef22
Merge test SHA: 6f6bcefb2b7ee775c2193fff99a5d001bf1c0c39

## Verified state
- PR 200 is OPEN and UNMERGED.
- It changes only public/index.html.
- DreamMee is compact at top-right.
- Billboard peek is no longer fixed to the viewport.
- CI is NOT green.
- Public Surface Gate failed at public route allowlist.
- DreamLedger Ignition Verifier failed.
- MTG Diagnostic Fulfillment Gate failed at public-surface verification.
- IP Integrity and Commerce CI/CD failed during compile:commerce surface.
- Molt Beach verifier reported Vercel /board route failure.
- MCP Security, Acquisition Proof, economic-revenue, build, Compiler, Gauntlet Release, Security Baseline, Public Surface Guard, CUBE Marketplace, and production finisher gates passed.
- No PR reviews or review threads are present.

## Repair rule
Do not merge PR 200. Fix root causes only. Never weaken or bypass a gate and never make a private route public just to satisfy a test.

## Required repair
1. Inspect the exact failing workflow and verifier source on the PR merge tree.
2. Explain the public route allowlist failure.
3. Explain the ignition verifier failure.
4. Explain the MTG fulfillment public-surface failure.
5. Explain compile:commerce failure.
6. Explain the /board Vercel route failure.
7. Repair root causes.
8. Preserve catalogue-first UX, horizontal swipe rails, compact DreamMee, contained billboard, human copy, no payment-logo strip.
9. Preserve the canonical Commander Deck Diagnostic paid wedge.
10. Preserve public/private silo separation.
11. Run the full verification matrix.
12. Emit machine-readable proof.
13. Push fixes to PR 200 branch only. Do not merge.

## Required PASS gates
npm compile; verify:ip; verify:molt-beach; verify:silos; public route allowlist; public leakage scan; sensitive literal scan; public server syntax; ignition verifier; MTG diagnostic fulfillment gate; commerce compile; economic revenue gate; MCP security gate; acquisition proof gate; production finisher gate; Compiler gate; Gauntlet Release gate.

## Economic truth
Revenue proven remains NZ$0 until an independently verified stranger payment exists. No click, checkout creation, self-purchase, or configuration event may claim RA_000001.

## Homepage acceptance
DreamLedger is the brand. MTG and billboard are product families. The catalogue is the main event. Billboard is one contained module. DreamMee remains compact and top-right. No fixed billboard overlay. No internal BEC language. No Visa/Mastercard logo spam. No invented scarcity, bestseller, inventory, or revenue claims.

## Evidence
Every verification run must record UTC timestamp, repository, PR, base SHA, head SHA, tested SHA, every check, result, failure detail, and artifact hashes. READY_FOR_MERGE is legal only when every required gate is PASS. Economic state remains PRE_REVENUE until RA_000001 is independently proven.
