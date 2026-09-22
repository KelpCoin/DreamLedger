# Agent Passports and the DreamLedger Trust Wedge

Status: design contract, 2026-09-22
Scope: settle lobe / agentic commerce / public trust surface
Revenue status: does not create or recognize revenue

## Purpose

DreamLedger is a ledger-shaped public trust surface. The trust wedge is not an AI saying it is trustworthy. It is a machine-readable, evidence-backed record of what an agent is, what it is allowed to do, what it has actually done, and what evidence supports those claims.

The passport is an identity-and-capability envelope around an agent. It is not a revenue credential by itself.

## Current standards landscape

A2A defines an Agent Card as a machine-readable description of an agent's identity, capabilities, skills, endpoint, and authentication requirements. Agent Cards can be discovered through a well-known URI or a registry, and may be signed.

An emerging separate concept is an execution/trust passport. The September 2026 ATEP Internet-Draft proposes a portable passport computed from append-only execution logs, including capability domains, success history, trust tiers, and badges. ATEP is an individual Internet-Draft, not a settled universal standard, so BEC should borrow the useful idea without claiming conformance.

Payment networks are independently converging on the same trust problem: authenticated agents, human-to-agent binding, purchase intent, authorization, transaction limits, and auditability. BEC should therefore treat agent identity, authority, intent, execution evidence, and settlement proof as separate layers.

## BEC passport model

A BEC passport has five layers:

1. Identity
   - stable agent_id
   - issuer
   - public key / verification method when available
   - version
   - creation and expiry timestamps
2. Capability
   - declared skills
   - supported protocols
   - reachable tools
   - allowed silos
   - allowed action classes
3. Authority
   - who authorized the agent
   - scope
   - expiry
   - spending/publishing limits
   - human gate requirements
4. Execution evidence
   - append-only execution references
   - task IDs
   - outcome status
   - verification status
   - reproducible evidence hashes
   - failed/rejected actions as well as successes
5. Economic evidence
   - offer IDs
   - external transaction IDs
   - settlement status
   - fulfillment evidence
   - fossil references
   - verified revenue only when the existing BusinessTruth dam accepts it

## Trust dimensions

Do not make a single opaque trust score.

Expose independent dimensions:

- identity_verified
- authority_verified
- capability_verified
- execution_history_verified
- fulfillment_history_verified
- settlement_history_verified
- evidence_integrity_verified

A passport can therefore say: identity verified, capability verified, 17 completed tasks, 3 rejected tasks, 0 verified settlements, without manufacturing a reputation score.

## Public DreamLedger wedge

The public surface should answer:

Who or what is this agent?
What can it actually do?
What authority does it have?
What has it actually completed?
What evidence can I inspect?
Has it ever participated in a verified commercial settlement?

The public page should distinguish DECLARED, OBSERVED, VERIFIED, CONTRADICTED, and EXPIRED.

A claim never becomes VERIFIED merely because an agent reports it.

## Anti-gaming rules

- No self-awarded trust tiers.
- No manually editable success counters.
- No deleting failed execution history to improve reputation.
- No treating model confidence as execution evidence.
- No treating a checkout open as payment.
- No treating a checkpoint as execution completion.
- No treating an agent passport as payment authorization.
- No cross-silo evidence leakage.
- Expired authority cannot authorize new side effects.
- Settlement evidence remains controlled by Settlement Sync and the existing fossil chain.

## Agent Card vs Passport

Agent Card = what this agent says it can do and how to reach it.
Passport = what independently recorded evidence says this agent has done, under what authority.

They complement each other. BEC should expose an Agent Card for interoperability where useful, and a richer passport/evidence view for trust.

## DreamLedger implementation direction

A future public route can expose a sanitized passport at /agents/<agent_id> and an interoperable card at /.well-known/agent-card.json.

The public representation must not expose secrets, internal credentials, private prompts, private customer data, or unrestricted internal logs.

Paid/high-value views may expose richer evidence where entitlement policy permits it. The public truth layer remains inspectable enough to establish methodology and credibility.

## Trust wedge

The commercial wedge is not selling AI trust as an abstract promise. It is making economic claims inspectable.

DreamLedger can become a place where an agent, offer, marketplace action, and settlement claim each have a visible provenance chain:

agent → authority → action → transaction → fulfillment → evidence

That is directly aligned with the ledger concept and the existing evidence dam.

## Non-goals

This document does not authorize autonomous spending, publishing, marketplace account creation, or revenue recognition.

The passport is an evidence surface and trust primitive. Settlement remains external and independently proven.