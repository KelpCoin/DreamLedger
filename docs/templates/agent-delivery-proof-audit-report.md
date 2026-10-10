# DreamLedger Agent Delivery Proof Audit

**SKU:** AGENT-PROOF-AUDIT-49  
**Price:** NZ$49 one-time  
**Target:** Within 24 hours after complete intake  
**Report status:** DRAFT until a reviewer fills every applicable field

---

## 1. Audit record

- Audit ID:
- Stripe Checkout Session ID:
- Payment status: UNVERIFIED / SETTLED / REFUNDED / DISPUTED
- Intake-complete timestamp (UTC):
- Report timestamp (UTC):
- Reviewer:
- Subject kind: URL / FILE / API / OTHER
- Subject URL or artifact identifier:
- Artifact SHA-256 (if a stable file was obtained):
- Artifact size / media type:
- Scope version:
- Source snapshot timestamp:

## 2. Request and scope

**Customer's decision question**

> [Restate the question without expanding scope.]

**Acceptance criteria (agreed before review)**

| ID | Criterion | Pass evidence required | Out-of-scope interpretation |
|---|---|---|---|
| C1 | [Criterion] | [Observable evidence] | [Boundary] |
| C2 | [Criterion] | [Observable evidence] | [Boundary] |
| C3 | [Criterion] | [Observable evidence] | [Boundary] |
| C4 | [Criterion] | [Observable evidence] | [Boundary] |
| C5 | [Criterion] | [Observable evidence] | [Boundary] |

## 3. Executive result

**Overall status:** PASS / FAIL / NEEDS HUMAN REVIEW / INCONCLUSIVE

**What this result means:** The result applies only to the listed criteria, artifact version, sources, and review time. It is not a universal statement that the system is safe, correct, compliant, or commercially successful.

**Summary:**
- Confirmed:
- Failed:
- Unresolved:
- Highest-priority next action:

## 4. Criterion-by-criterion findings

| Criterion | Status | Test performed | Observed result | Evidence reference | Confidence / limitation |
|---|---|---|---|---|---|
| C1 | PASS / FAIL / NEEDS HUMAN REVIEW / INCONCLUSIVE | [Exact action] | [Observable result] | [URL, file path, line, timestamp, hash] | [Reason] |

Repeat one row per criterion. Do not infer a PASS from absence of a failure. Missing or inaccessible evidence is not a pass.

## 5. Source and evidence register

| Ref | Source URL / artifact | Publisher or origin | Observed at (UTC) | Relevant excerpt / observation | Integrity / freshness note |
|---|---|---|---|---|---|
| E1 | [URL or identifier] | [Origin] | [Timestamp] | [Short excerpt or test observation] | [Hash, version, freshness, access caveat] |

Keep source claims, reviewer observations, and inferences separately labelled.

## 6. Reproduction steps

1. [Exact URL, command, or navigation step]
2. [Inputs and relevant configuration]
3. [Expected result defined by criterion]
4. [Observed result and timestamp]

Do not include secrets, access tokens, personal data, or exploit instructions beyond what is needed to explain the bounded finding.

## 7. Integrity and delivery evidence

- Reviewed artifact SHA-256:
- Hash algorithm and tool:
- Source snapshot or retrieval timestamp:
- Report file SHA-256:
- Cryptographic signature: NOT GENERATED / GENERATED AND VERIFIED
- Signature algorithm / key identifier (if applicable):
- Delivery channel:
- Delivery timestamp:
- Delivery receipt or message identifier:
- Reviewer confirmation:

A hash establishes byte-level identity for the hashed file; it does not establish that the file is truthful or correct. Never label a report signed unless the signature was actually generated and validated.

## 8. Limitations and unresolved questions

- [Unavailable source, missing context, ambiguity, or test boundary]
- [What evidence would resolve it]
- [Any criteria not assessed and why]

## 9. Recommended actions

| Priority | Action | Why it matters | Evidence of completion |
|---|---|---|---|
| P1 | [Action] | [Finding it addresses] | [Observable acceptance test] |

## 10. Quality gate before delivery

- [ ] Payment independently confirmed as settled, not inferred from checkout creation.
- [ ] Scope and acceptance criteria are recorded.
- [ ] Every finding links to evidence or is explicitly marked as inference.
- [ ] Every criterion has a status.
- [ ] Missing evidence is not labelled PASS.
- [ ] Artifact and report hashes are recorded when applicable.
- [ ] Any signature claim was cryptographically validated.
- [ ] Limitations and unresolved questions are visible.
- [ ] Report does not claim certification, comprehensive security, or guaranteed outcomes.
- [ ] Delivery event is recorded separately from payment.

**Final reviewer disposition:** READY TO DELIVER / HOLD FOR REVIEW  
**Reason:** [Required]
