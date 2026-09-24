# BUG-SURFACE-COMPILER-QUOTE-SYNTAX-20260925

Observed: GitHub Actions run 36007342975 at commit 49594d7f1b6bd756de929d62d49ed1e481957db2 failed during Compile canonical Cortex surfaces. Node reported SyntaxError: Unexpected string in BEC-PRIME/compiler/SurfaceCompilerStable.js while compiling the generated 500-lane catalogue.

Broken contract: the stable public-surface compiler must parse and compile before downstream verification; a syntax error must not block the production verification spine.

Ten repair paths:
1. Escape the embedded quote key inside the string literal. Mechanism: minimal source edit. Dependencies: none. Risk: low. Reversible: yes. Verification: compile. Economic effect: restores compiler gate.
2. Replace the quote-key lookup with charCodeAt logic. Mechanism: removes nested quote ambiguity. Dependencies: none. Risk: low. Reversible: yes. Verification: compile. Economic effect: restores compiler gate.
3. Extract the esc helper outside the generated HTML string. Mechanism: separates JS and HTML construction. Dependencies: refactor. Risk: medium. Reversible: yes. Verification: compile plus surface tests. Economic effect: reduces recurrence risk.
4. Use JSON.stringify for escaped text. Mechanism: serializer-backed escaping. Dependencies: none. Risk: medium because HTML escaping semantics differ. Verification: XSS/surface tests. Economic effect: improves safety.
5. Add a template-literal generated page. Mechanism: changes quoting model. Dependencies: refactor. Risk: medium. Verification: compile. Economic effect: no direct revenue effect.
6. Add a standalone HTML helper module. Mechanism: isolates escaping. Dependencies: module boundary. Risk: medium. Verification: unit tests. Economic effect: lowers maintenance cost.
7. Replace inline JS escaping with DOM text rendering. Mechanism: avoid HTML string interpolation. Dependencies: browser behavior. Risk: medium. Verification: live UI test. Economic effect: lower client injection risk.
8. Disable silos.html generation until compiler rewrite. Mechanism: bypasses failing surface. Dependencies: none. Risk: high because it hides/degrades a public surface. Verification: incomplete. Economic effect: negative/uncertain.
9. Mark compiler failure non-fatal. Mechanism: allow deployment despite invalid compile. Dependencies: workflow change. Risk: unacceptable because it hides failure. Verification: weak. Economic effect: unsafe.
10. Revert the entire prior surface feature. Mechanism: restore last known compiling compiler. Dependencies: loss of new account/catalog surface. Risk: medium/high. Verification: compile. Economic effect: removes capability.

Selected repair: #2, replace the nested single-quoted quote-key expression with explicit character handling. Selection reason: smallest safe reversible edit that preserves behavior and removes the exact parser ambiguity.

Files changed: BEC-PRIME/compiler/SurfaceCompilerStable.js
Implementation commit: b1beddce7fbd981b86d8b24351c3c7a25891ea7f
Verifier: GitHub Actions surface/compile workflows on pushed commit.
Verifier result: awaiting queued run completion at observation time.

Economic state: VERIFIED_EXTERNAL_REVENUE NZ$0; no payment promoted.
Remaining blocker: verification queue has not yet completed on the repair commit.
Next transition: observe compile/checkout verification; if compiler passes, reconcile Stripe and retain NZ$0 until a settled attributed external payment exists.
