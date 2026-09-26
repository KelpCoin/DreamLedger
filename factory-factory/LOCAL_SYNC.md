# Local / Cloud Sync Contract

Canonical local root: D:\\BrownEyeCortexData

Canonical cloud: Supabase project wbwgroygjeyukkspnqiy

First silo: Happy Home Road / MTG.

Required local mirrors:
- factory-factory/cells/happy-home-road-mtg.json
- factory-factory/manifest.json
- generated proof JSON under the canonical BrownEye proof/artifact tree

Cloud mirrors:
- factory_instances
- factory_runs
- factory_signals
- commerce_cells
- economic_actions

The verifier must compare the SHA-256 of the local cell contract with the SHA stored in cloud factory state.

A local path appearing in historical indexed files is not proof that this runtime can write to that user's physical disk. A write-capable local agent must execute the sync step before LOCAL_SYNC is marked VERIFIED.
