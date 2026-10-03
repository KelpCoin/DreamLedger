# Swarm Orchestration Adapter

This adapter defines the contract for wiring an external durable workflow engine into DreamLedger.

The adapter is intentionally dependency-free at this stage. It records the mapping before runtime installation so the economic truth substrate cannot accidentally become coupled to an external orchestration product.

## Required operations

- submit_discovery_batch
- fanout_source_jobs
- collect_source_results
- normalize_observations
- run_mass_admission
- run_capability_match
- run_traversability
- produce_human_gate_queue
- record_workflow_trace
- recover_interrupted_workflow

## Forbidden operations

The orchestration layer MUST NOT:
- create synthetic opportunities
- create synthetic buyers
- claim payment
- mark revenue verified
- mark fulfillment complete without evidence
- send external messages without explicit authorization
- submit marketplace bids without explicit authorization
- mutate economic truth merely because a workflow completed

## Queue contract

The discovery queue is an observation queue, not an economic-outcome queue.

A workflow completion means:
WORKFLOW_COMPLETED

It does not mean:
TRANSACTION_COMPLETED

## Future runtime

The first runtime implementation should use Dapr Agents durable workflows for discovery fan-out/fan-in and preserve DreamLedger as the persistence and truth boundary.

FleetQ remains a reference candidate for DAG/MCP/HITL patterns until compatibility, licensing, operational cost, and security boundaries are independently validated.
