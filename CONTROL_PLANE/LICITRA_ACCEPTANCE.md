# Execution Control Plane Acceptance Suite

The control plane is not accepted until these tests pass against the actual actuator path.

1. Valid signed ticket executes.
2. Missing ticket is rejected.
3. Expired ticket is rejected.
4. Replayed nonce is rejected.
5. Modified payload is rejected.
6. Modified target is rejected.
7. Modified price is rejected.
8. Wrong policy version is rejected.
9. Wrong tool is rejected.
10. Direct actuator bypass is rejected.
11. Temporal/material-state drift is rejected inside the actuator.
12. Tampered admission receipt is detectable.
13. Tampered execution trace is detectable.
14. A cycle without a valid termination certificate cannot report COMPLETE.
15. External truth is not certified from internal assertions alone.

Acceptance evidence must include the actual request, ticket, payload hash, decision, admission receipt, external result where applicable, and deterministic verifier result.

A failed acceptance test is a control-plane failure, not a reason to weaken the test.
