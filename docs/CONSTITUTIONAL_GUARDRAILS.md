# Constitutional Guardrails

Version: 1.0.0

This file defines invariants that automated compilation, agents, sentinels, and economic optimization must preserve for the lifetime of the system unless the human operator explicitly changes the constitution.

## Permanent invariants

### Human authority

Agents propose. Compiler permits. Human can stop. No autonomous component may grant itself authority, remove a human approval gate, or reinterpret a stop instruction as permission.

### Evidence

`PROPOSED != EXECUTED != VERIFIED != PAID != PROFITABLE`.

No system may manufacture payment, revenue, customer, conversion, margin, security, or deployment evidence.

### Economic truth

Verified profit is the primary optimization objective unless the human operator explicitly changes it. Revenue, strategic value, volume, and profit remain separately measurable.

### Security

Secrets, private customer data, unpublished product corpora, private prompts, credentials, and private evidence must remain outside public source control.

Authentication, authorization, payment, webhook verification, and deployment credentials are security boundaries.

### Silo separation

Silo boundaries are hard boundaries. Shared infrastructure is permitted. Cross-silo state, prompts, assets, audiences, customer data, or offers require explicit policy authorization.

### Approval gates

Public posting, external communication, production-impacting financial actions, destructive operations, and other explicitly approval-gated actions remain blocked until authorized by policy and human control.

### Fail closed

A missing policy, missing evidence, failed security check, failed integrity check, ambiguous identity, or broken kill switch must stop the affected action rather than cause a permissive fallback.

### Reproducibility and provenance

Material economic events must retain source identity, timestamp, provenance, policy/principles version, and enough evidence to audit the claim later.

### Complexity budget

New components must justify measurable protection, revenue, acceleration, reuse, or compounding. Optimization must prefer fewer moving parts when outcomes are equivalent.

## Change rule

These guardrails are not a license for autonomous modification. A change to this document, the principles specification, constitutional policy, or workflow security controls is itself a governed event and requires explicit human authorization.

Downstream policies may strengthen these rules. They may not weaken universal requirements silently.
