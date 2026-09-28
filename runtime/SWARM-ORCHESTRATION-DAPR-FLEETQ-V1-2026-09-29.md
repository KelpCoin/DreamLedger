# DreamLedger Swarm Orchestration V1

## Purpose

Add durable orchestration capability to the existing DreamLedger swarm without replacing the DreamLedger economic truth substrate.

## Selected external substrates

### Dapr Agents
Dapr Agents is the primary orchestration substrate. It provides durable workflows, state, messaging, observability, multi-agent coordination, and MCP tool discovery.

Repository: https://github.com/dapr/dapr-agents

Use it for:
- durable Scout and analysis workflows
- fan-out/fan-in discovery
- retries and recovery
- event-driven triggers
- MCP tool discovery
- workflow state

### FleetQ / Agent Fleet
Repository: https://github.com/escapeboy/agent-fleet-o

FleetQ is treated as a secondary reference/integration candidate for visual DAGs, MCP connectivity, human approval, queues, audit trails, and agent crews.

It is NOT a replacement for DreamLedger and is NOT a dependency of the first implementation.

## DreamLedger boundary

DreamLedger remains authoritative for:
- opportunity identity
- provenance
- admission state
- capability registry
- traversability
- authorization
- economic truth
- settlement
- fulfillment
- proof

External orchestration must never be allowed to manufacture:
- buyers
- payments
- revenue
- fulfillment
- evidence
- authority

## Target flow

SOURCE SIGNALS
→ DISCOVERY WORKERS
→ NORMALIZE
→ DEDUPE
→ FRESHNESS
→ MASS ADMISSION
→ CAPABILITY MATCH
→ TRAVERSABILITY
→ EXECUTION FRONTIER
→ HUMAN GATE
→ EXTERNAL ACTION
→ SETTLEMENT
→ FULFILLMENT
→ PROOF
→ VERIFIED ECONOMIC OUTCOME

## Initial swarm topology

SCOUTS:
- public demand discovery
- public procurement discovery
- public job/request discovery
- software/data demand discovery
- recurring service-demand discovery

PROCESSORS:
- normalizer
- deduper
- freshness evaluator
- capability matcher
- traversability evaluator
- economics evaluator
- Gauntlet
- Truth verifier

CONTROLLER:
- continuously allocate discovery capacity according to source yield
- throttle failing/stale sources
- prioritize sources producing qualified/traversable opportunities
- keep human-gated work bounded

## Authority

A0 observation is autonomous.
A1 internal processing is autonomous.
A2 preparation is autonomous.
A3 external action remains explicitly authorized and human-gated.

No imported framework may escalate authority.

## Deployment posture

This document and adapter scaffolding are cloud-repository changes only.
No Render deployment is implied.
No external outreach, bidding, payment, purchase, or representation is implied.
