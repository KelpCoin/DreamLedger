# 3MV6 Development Engine

3MV6 is the content-production engine, not the game runtime and not the commerce runtime.

Its job is to turn compact deterministic definitions into large, culturally coherent asset families for Kelplantis, DreamMeez, and approved commerce surfaces.

## Target

The engine is designed to scale content production across:

- thousands of mobs
- hundreds of bosses
- thousands of items
- NPCs and settlements
- houses, furniture and property
- DreamMeez bodies, outfits, accessories and effects
- guild banners, titles and achievement surfaces
- isolated commerce catalog seeds

The game remains persistent. Gear is persistent by default. Canonical boss clears create progression credentials. The engine creates definitions and manifests; the authoritative runtime owns player state.

## Design principle

`definition -> deterministic seed -> generated asset manifest -> proof -> approved runtime/catalog`

The engine must never silently turn generated content into public commerce or production game state.

## Existing Kelplantis integration

The current repository already contains the Kelplantis floor-profile generator, deterministic dungeon generator, target compiler, runtime, adapter and proof artifacts. The 3MV6 layer sits above those systems as a content factory rather than replacing them. The existing target compiler and dungeon generator are therefore preserved.

## First executable proof

From the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\BEC-PRIME\scripts\Verify-3MV6DevelopmentEngine.ps1
```

The verifier generates a development manifest and writes the proof to:

`BEC-PRIME\RUN-PROOFS\3MV6-DEVELOPMENT-ENGINE-PROOF.json`

A runtime deployment, public catalog, or player-facing asset release remains approval-gated.
