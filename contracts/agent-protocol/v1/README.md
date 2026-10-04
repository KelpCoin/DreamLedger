# DreamLedger Agent Protocol v1

Purpose: compact, model-neutral communication between CUBE, Cortex, Elohim, Figure Eight, fulfillment, and Truth Oracle without turning model conversation into economic truth.

Core rule:

LLMs may propose. Structured protocols may coordinate. Authoritative systems establish reality.

Message types are deliberately small:
- OBSERVE
- CLAIM
- EVIDENCE
- CONSTRAINT
- DECISION
- ACTION
- RESULT

State is referenced by stable IDs rather than copied into prompts. The receiver should fetch canonical state from the authoritative store when required.

Economic firewall:
- LLM claims do not create VERIFIED economics.
- A payment observation must identify an external transaction and external evidence.
- VERIFIED requires authoritative verification, including signature verification where the rail supports signed provider evidence.
- TEST, SIMULATED, INTERNAL, and UNMATCHED observations never count as verified revenue.
- This protocol does not authorize autonomous spending or external action. Existing human gates and execution authority remain in force.

Canonical schemas:
- agent-message.schema.json
- task-ref.schema.json
- decision.schema.json
- economic-event.schema.json

Implementation rule:
Use these schemas to reduce inter-agent payloads, not to create a new orchestration engine. Existing tasks, economic actions, Truth Oracle, Figure Eight, fulfillment, and provider integrations remain authoritative.

Versioning:
v1 is additive and reversible. New fields or protocol versions must not reinterpret historical economic events.
