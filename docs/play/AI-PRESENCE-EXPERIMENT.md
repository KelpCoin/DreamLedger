# Single-shard AI Presence Experiment

Status: design/build contract, 2026-09-22
Scope: play lobe only
Economic authority: none

## Experiment

Build a single-shard PVE MMORPG where the population contains real human players, persistent logout ghosts, a small server-controlled AI cohort, and AI characters using the same player command surface and server validation as humans.

The experiment observes what behavior emerges as AI population changes with actual human population.

## Logout presence

When a human logs out:
- retain the character in the same world area;
- retain approximately 10% of normal combat strength;
- keep the shell subject to ordinary world rules;
- do not grant administrative powers;
- persist enough state to restore the player cleanly on login.

The 10% figure is an operator-selected starting policy, not a universal balance constant.
A logout ghost is not automatically promoted into a full AI brain.

## AI cohort scaling

Conceptual function: ai_target = min(hard_cap, floor(active_humans * ai_ratio))

Initial parameters remain low enough to observe behavior and control compute cost. Ratio and cap belong in configuration.

Phase-0 invariant: AI_COUNT <= 5.

Record active_human_count, active_ai_count, and the reason for every AI spawn/despawn decision.

## Full player parity

AI-controlled characters use the same legal action surface as human players: movement, combat, abilities, gathering/crafting, inventory, quests, parties, guild creation and participation, progression, and chat where permitted.

The authoritative server validates every action. AI receives no hidden admin powers.

## Guild experiment

AI may found and operate guilds under the same game rules as humans.

Observe whether AI forms all-AI guilds, seeks human guild membership, gets invited by humans, develops objectives, specializes resources, competes for nodes, cooperates, conflicts, and persists through population changes.

These are observations, not predetermined outcomes.

## Brain architecture

1. Server perception and legal-action enumeration.
2. Cheap utility/GOAP/behavior-tree decision layer.
3. Optional asynchronous LLM goal/strategy layer.
4. Server-side validation.
5. Action execution.
6. Event logging.

Do not place an LLM call on every combat frame.
The LLM proposes goals or longer-horizon decisions. The deterministic game server decides what is legal.

## Presence state

Controller states:
- HUMAN_ACTIVE
- HUMAN_GHOST
- AI_ACTIVE
- AI_IDLE
- AI_DESPAWNED

Internal metadata may record controller type, cohort ID, spawn reason, target ratio, model/runtime version, decision budget, and last decision timestamp.

Client-facing disclosure is a separate product/legal decision. Internal records must always distinguish human, ghost, and AI control.

## Experiment logging

Each AI action should be attributable to character_id → controller → cohort → decision_id → action → server_result.

High-level behavior should preserve decision_id → perception snapshot → goal → candidate actions → selected action → outcome.

Logs are for behavioral analysis and replay. They are not commercial revenue evidence.

## Safety and fairness boundaries

- Same server rules for humans and AI.
- Same economy caps and cooldowns.
- Same anti-cheat validation.
- No AI real-money trading.
- No AI control of Stripe or settlement.
- No hidden commercial authority.
- Low initial population.
- Hard kill switch for the AI cohort.
- Resource budgets and rate limits.
- Moderation/abuse controls apply to AI interactions.

## Research questions

1. How does AI density affect perceived world activity?
2. What guild structures emerge?
3. Do AI agents specialize or converge on dominant strategies?
4. Does human behavior change when AI population changes?
5. What happens when AI characters persist after human logout?
6. How stable are AI-created guilds?
7. Does AI cooperation produce different resource patterns than independent agents?
8. Which behaviors survive when the LLM layer is removed and only utility/GOAP remains?

Preserve the possibility that the result is boring, unstable, exploitative, or unexpectedly useful. Do not pre-write the conclusion.

## Relationship to DreamLedger

The play experiment is a retention/behavior surface, not the settlement engine.

Play events may share identity and evidence infrastructure, but must never increment verified_external_revenue_nzd.

play outcome → observation
not
play outcome → revenue.