# LM Studio Multi-LLM Iterative Refinement v1

The local swarm is a panel, not a single-model oracle.

## Roles
- SCOUT: broad discovery, extraction and opportunity generation.
- ANALYST: qualification, economics, traversability and capability analysis.
- BUILDER: turns qualified work into concrete deliverables and execution plans.
- CRITIC: attacks assumptions, evidence quality, freshness and failure modes.
- GAUNTLET: adversarial authority/safety gate.
- SYNTHESIZER: reconciles the panel into one next-action packet.

Any available local LM Studio model may fill a role. Roles are configured independently through environment variables, allowing heterogeneous models.

## Iterative loop
1. CUBE supplies the current evidence packet.
2. SCOUT expands or refreshes candidates.
3. ANALYST scores factual fit without creating economic truth.
4. BUILDER proposes the smallest useful artifact or next internal action.
5. CRITIC attempts to falsify it.
6. GAUNTLET checks authority, access, legality/platform constraints and external-action boundaries.
7. SYNTHESIZER incorporates accepted criticism and emits the next state.
8. Repeat until convergence, a new external fact appears, or HUMAN_GATE/STOP is reached.

## Refinement rules
- A later model cannot silently erase an earlier blocker.
- Every accepted change cites evidence.
- Contradictory outputs are preserved, not averaged into false certainty.
- UNKNOWN remains UNKNOWN.
- Confidence is not evidence.
- Consensus is not truth.
- The final synthesizer cannot authorize an action prohibited by Gauntlet.
- Iteration stops when the packet is materially unchanged for three rounds or when the configured maximum rounds is reached.

## Model allocation
Environment variables:
- DREAMLEDGER_SCOUT_MODEL
- DREAMLEDGER_ANALYST_MODEL
- DREAMLEDGER_BUILDER_MODEL
- DREAMLEDGER_CRITIC_MODEL
- DREAMLEDGER_GAUNTLET_MODEL
- DREAMLEDGER_SYNTHESIS_MODEL

If a role is not configured, the orchestrator may select an available local model. A missing required role blocks that stage rather than inventing a result.

## Economic rule
More models do not create more revenue. They create a stronger decision process. Only independent external evidence can change verified economic truth.
