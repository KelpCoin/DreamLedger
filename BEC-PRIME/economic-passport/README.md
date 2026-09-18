# Economic Passport

The Economic Passport is the machine-readable commercial contract for a BEC SKU.

It separates four concerns:

1. COMMERCIAL_TRUTH: what is being sold, by whom, and at what price.
2. AUTHORITY: who may resell it, where, and under what rights and margin.
3. EXECUTION: what happens after purchase and what fulfilment requires.
4. EVIDENCE: what must exist to establish that fulfilment happened.

## Status

`DRAFT`, `ACTIVE`, `SUSPENDED`, `EXPIRED`, `REVOKED`.

## Truth

`UNVERIFIED` is a valid initial state. A Passport does not turn supplier claims into facts merely because they are encoded as JSON.

Truth states supported by the evidence layer are:

`UNVERIFIED`, `VERIFIED`, `CONTRADICTED`, `STALE`, `CONFLICTED`.

## First traversal

REAL PRODUCT -> ECONOMIC PASSPORT -> RESALE INTERPRETATION -> FULFILMENT -> EVIDENCE -> VERIFICATION

The first example is deliberately not presented as verified revenue or a completed external sale.

## Standards

The schema uses JSON Schema Draft 2020-12, the current released JSON Schema specification. See https://json-schema.org/specification.

Agent-facing integration can later expose the Passport through existing protocols such as MCP. The Passport itself does not depend on MCP.
