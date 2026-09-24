# BUG-FIRST-SALE-GATE-SILO-MISMATCH-20260925

Observed: first-sale-gate run 36007701587 failed at canonical Founding Tile verification with WRONG_FOUNDING_TILE_SILO. The approved offer OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001 is explicitly silo=dreamledger, while the workflow configured TARGET_SILO=media.

Broken contract: the first-sale gate must verify the canonical approved Founding Tile offer against its actual approved silo, not an unrelated legacy silo label.

Ten repair paths:
1. Change TARGET_SILO from media to dreamledger. Low risk, reversible, exact contract repair, verification rerun.
2. Read target silo dynamically from approved.json. Medium risk, reduces drift, requires script change.
3. Remove silo assertion. High risk, weakens isolation gate, reject.
4. Change approved offer silo to media. High risk, mutates canonical commercial identity, reject.
5. Add an alias media->dreamledger. Medium risk, hides canonical identity, reject.
6. Select a different media offer. High risk, changes first-sale target without evidence, reject.
7. Add workflow-time canonical silo discovery and assert equality. Medium risk, stronger but more code.
8. Disable first-sale gate. High risk, hides failure, reject.
9. Make silo mismatch warning-only. High risk, weakens gate, reject.
10. Revert billboard offer. High risk, discards current canonical offer, reject.

Selected repair: #1. It is the smallest reversible correction and matches the approved offer registry exactly.

Implementation target: .github/workflows/bec-prime-first-sale-gate.yml
Change: TARGET_SILO=media -> TARGET_SILO=dreamledger.
Verification: rerun on current main after repair.
Economic state: VERIFIED_EXTERNAL_REVENUE NZ$0. This repair changes no revenue state.
Next transition: pass canonical offer gate, then verify live doorway and preserve human approval / payment evidence requirements.
