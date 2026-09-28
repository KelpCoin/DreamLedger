# Production Observation Probe

Purpose: move one real persisted observation through projection and transition logic without writing, authorizing, executing, or inventing economic state.

Source order:
1. public.economic_execution_packets / public.economic_actions
2. payment observations
3. fulfillment and evidence observations

Output is exactly one of:
- NEXT_STATE
- EXACT_BLOCKER
- OBSERVATION_ONLY

A database connector must provide the actual row before this probe can be called a production observation. Missing connector output is not treated as zero rows and is not substituted with fixture data.

Current connector attempt on 2026-09-29 returned no usable SQL result. Therefore no production observation was claimed.

The probe code is ready for the first actual row:
runtime/economic/production_observation_probe.py
