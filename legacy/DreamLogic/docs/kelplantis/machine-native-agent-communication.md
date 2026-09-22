# Phin Haven: Machine-Native Agent Communication

Status: IMPLEMENTATION CONTRACT / 2026-09-21

## Purpose

Phin Haven AI entities should communicate through compact machine-native messages where natural-language conversation is unnecessary. This is a transport and coordination optimization, not a replacement for evidence or human auditability.

## Architecture

GAME STATE -> EVENT DELTA -> AGENT OBSERVATION -> COMPACT INTENT/ACTION -> GAME EXECUTION -> EVENT -> LEDGER/PASSPORT -> GAUNTLET

The game engine owns deterministic mechanics such as collision, pathfinding, targeting, damage, inventory rules, and valid state transitions. Agents choose goals and actions rather than simulating every low-level input.

## Protocol principles

1. Prefer structured fields and event IDs over prose.
2. Send state deltas rather than repeating unchanged state.
3. Use schemas with versioned meanings.
4. Permit specialized schemas for navigation, combat, social, guild, and economic coordination.
5. Every consequential action must remain traceable to an event.
6. Machine-native messages may be compact or non-human-readable, but the authoritative event/evidence layer must remain inspectable.
7. No communication optimization may bypass game permissions, economic controls, or Gauntlet checks.

## Example

Human-readable intent:

"The eastern mine has high iron availability, two hostile creatures, and a safer eastern approach."

Machine-native observation:

OBS{loc:N-MINE,res:FE=HIGH,hostile=2,route=E,conf=.94}

Machine-native action:

ACT{goal=IRON,route=E,mode=SAFE}

The exact encoding is implementation-dependent. The semantics are not.

## Agent competence

AI agents should not require an LLM call for every frame or movement step. Reusable deterministic skills should handle routine mechanics. Model inference should be reserved for planning, prioritization, adaptation, social decisions, unusual events, and other decisions where reasoning adds value.

Candidate reusable skills:
- navigate_to
- harvest_resource
- retreat_from_combat
- engage_target
- escort_entity
- defend_territory
- trade_resource
- accept_contract
- investigate_location
- assist_entity

## Swarm coordination

Agents can exchange compact observations, requests, offers, warnings, assignments, and acknowledgements. Shared world state should reduce unnecessary peer-to-peer conversation.

Example:

REQ{type=DEFEND,floor=1,cell=7C,urgency=3}
ACK{agent=A17,eta=42}
DONE{agent=A17,event=E9912}

## Resource budget

Inference frequency must be treated as a tunable resource. Idle agents should use little or no model inference. High-value or ambiguous events can trigger deeper reasoning. This allows the number of embodied agents to scale independently from continuous LLM-token consumption.

## Audit boundary

Machine-native communication must never become an evidence-free authority. For consequential actions, retain:
- agent identity
- protocol version
- input event/state IDs
- selected action
- execution result
- resulting event ID
- Gauntlet verdict where applicable

## Phin Haven acceptance target

A prototype agent should demonstrate:
1. navigation without repeated obstacle loops;
2. deterministic skill execution without per-frame LLM calls;
3. goal selection using compact observations;
4. persistent memory through game events;
5. communication with another agent through structured messages;
6. Passport updates from resulting evidence;
7. Gauntlet rejection of invalid or unauthorized actions;
8. measurable inference/token use per meaningful decision.

## Economic boundary

This protocol can reduce coordination and inference overhead, but it does not create economic value by itself. Real-world economic claims remain subject to the existing external-customer, settled-payment, attribution, fulfilment, and evidence rules.
