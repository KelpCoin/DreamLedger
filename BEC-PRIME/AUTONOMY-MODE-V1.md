# BECK PRIME Autonomous Mode V1

Status: proposal-only autonomy.

The local model is an intelligence component, not an authority component.

Allowed autonomous behaviour:
- read allowlisted data
- analyse evidence
- generate economic proposals
- generate checkout proposals
- verify proofs
- retry analysis

Forbidden to the model:
- approve its own proposal
- mint or forge approval tokens
- execute payments
- access credentials
- publish publicly
- execute shell or PowerShell
- modify security policy
- modify the tool manifest
- delete files
- cross silo boundaries

Authority chain:

MODEL -> TRUTH ORACLE -> SECURITY GAUNTLET -> ECONOMIC COURT -> APPROVAL TOKEN -> EXECUTOR -> PAYMENT ADAPTER -> INDEPENDENT SETTLEMENT EVIDENCE

No amount threshold grants the model authority by itself. Proposal type, evidence state, tool capability, silo policy, credential access, destructive capability and Court policy are evaluated together.

The initial autonomous mode deliberately does not auto approve payments. That boundary can only be changed by a later, independently tested policy revision.

RA_000001 remains NOT_CLAIMED until a real stranger payment has independent settlement evidence.
