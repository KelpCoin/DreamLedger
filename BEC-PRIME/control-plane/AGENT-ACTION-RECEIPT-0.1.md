# BECK Agent Action Receipt v0.1

Status: design-only, non-economic, no runtime dependency.

Purpose: define the smallest portable proof object that the existing AgentBridge can carry when an agent acts through any execution substrate (API, browser, workflow engine, MCP, or other tool).

The receipt does not declare truth by itself and never declares revenue. It is an evidence package for Truth Oracle and Gauntlet review.

## Required fields

```json
{
  "schema": "BECK-AGENT-ACTION-RECEIPT-0.1",
  "receipt_id": "string",
  "correlation_id": "string",
  "agent": "string",
  "execution_substrate": "api|browser|workflow|mcp|other",
  "action_type": "string",
  "subject": {
    "type": "string",
    "id": "string"
  },
  "authority": {
    "mandate_id": "string|null",
    "approval_event_id": "string|null",
    "capabilities": []
  },
  "request": {
    "intent_hash": "string",
    "requested_at": "ISO-8601"
  },
  "observation": {
    "started_at": "ISO-8601|null",
    "completed_at": "ISO-8601|null",
    "result": "success|failure|partial|unknown",
    "result_hash": "string|null"
  },
  "evidence": [],
  "verifier": {
    "status": "UNVERIFIED|VERIFIED|CONTRADICTED|STALE",
    "verifier_agent": "string|null",
    "verification_event_id": "string|null"
  },
  "economic_effect": {
    "status": "NONE|CLAIMED|OBSERVED",
    "economic_event_id": "string|null"
  }
}
```

## Non-negotiable invariants

1. The acting agent cannot self-verify its own receipt.
2. Authority and execution are separate facts. A receipt without an authority reference is not evidence of authorization.
3. Observation is not proof of truth. The Truth Oracle remains the independent verifier.
4. A receipt cannot create revenue. Economic truth still comes from the canonical revenue ingress and ledger.
5. `economic_effect=OBSERVED` requires a linked canonical economic event. A claim, checkout URL, or agent statement is insufficient.
6. `ACTION_EXECUTED` remains subject to the existing `ACTION_APPROVED` gate.
7. Evidence must identify its provenance and should be hash-addressable where the source permits it.
8. The receipt is append-only evidence. Corrections create a new receipt or verification event rather than rewriting history.
9. Transport is substrate-neutral. Browser, API, workflow, MCP, and future execution systems feed the same receipt shape.
10. The bridge carries evidence; it does not become the economic authority.

## How this uses the existing bridge

The existing `STRUCTURED_EVENT` lane is sufficient for the first implementation. A receipt can be carried inside `evidence` on an existing event, correlated through `correlation_id`, and routed to Truth Oracle and Gauntlet without creating another transport.

No new database table, payment rail, worker, browser automation layer, or autonomous consequential action is required by this specification.

## Frontier target

The long-term primitive is not "an agent that can act." Many systems can do that.

The target primitive is a portable, independently verifiable record answering:

- What was the agent authorized to do?
- What did it actually attempt?
- What was observed?
- What evidence supports the observation?
- Who independently verified or contradicted it?
- What, if anything, happened economically afterward?

The first live economic transaction should precede productionizing this schema. Until then, it remains a deliberately small design target rather than another build program.
