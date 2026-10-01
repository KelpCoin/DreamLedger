# Modular Factory Local Worker Contract

Purpose: let a local worker such as LM Studio execute a placed factory instance without owning canonical state.

## Authority split

Cloud/Supabase is authoritative for factory instances, runs, leases, signals and evidence references.
The local worker is an executor. It may propose or perform bounded work, but it cannot promote production state or rewrite canonical evidence.

## Worker loop

1. Authenticate to the existing Agent Bridge / worker endpoint.
2. Claim an available orchestrator task using the existing task lease contract.
3. Resolve the task's factory instance and blueprint.
4. Read the factory input and constraints.
5. Call the local model through LM Studio's OpenAI-compatible HTTP API.
6. Execute only actions permitted by the instance autonomy level and blueprint ceiling.
7. Write outputs and evidence references back through the authenticated cloud path.
8. Record a POSITIVE or NEGATIVE signal when an observable outcome exists.
9. Record SYNTHESIZED or TRIANGULATED only when the derivation and source ancestry are explicit.
10. Finish the orchestrator task with the existing lease token.

## LM Studio starting point

Use the existing local LM Studio installation as the inference worker. The repository must not hard-code a model name or assume a specific port. Configure the worker with environment values such as:

- LM_STUDIO_BASE_URL=http://127.0.0.1:<configured-port>/v1
- LM_STUDIO_MODEL=<loaded-model-id>
- FACTORY_WORKER_ID=<stable-worker-id>
- FACTORY_MAX_COST_CENTS=<local budget>

The worker should prefer the local model for deterministic execution, classification, extraction, code transformation and evidence formatting. Escalation to another model is an explicit routing decision, not an automatic fallback that bypasses the control plane.

## Required output envelope

Every completed factory action should return:

- factory_instance_id
- run_id
- task_id
- action
- status
- output
- evidence_refs
- signal_type when applicable
- observed_at
- worker_id

## Hard stops

Stop without completing the task when:

- the lease is expired or no longer matches the worker;
- the factory instance kill switch is ON;
- the requested autonomy level exceeds the instance or blueprint ceiling;
- the action budget is exhausted;
- the task requests an external financial action without the existing economic authority path;
- required evidence cannot be produced;
- the model output cannot be validated against the task contract.

## First local proof

The first proof should be a non-financial factory run:

Truth Oracle Factory -> retrieve a known repository fact -> return source/evidence reference -> record a POSITIVE signal -> finish task.

Do not start by giving the local worker payment authority, production deployment authority or unrestricted shell access.
