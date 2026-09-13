# Kelplantis Domino Roadmap

Status: STAGED_SEQUENCE

This is a staged sequence, not proof that any future domino is implemented. Only the active domino may be executed at a time. Each completed domino must produce evidence before the next implementation domino is promoted.

## D1A - Gemini player-experience clue
STATUS: COMPLETE / RECORDED
Artifact: docs/KELPLANTIS-DOMINO-01A-PLAYER-EXPERIENCE.md
Source: Gemini
Purpose: Define the first 10-minute player loop and acceptance tests.

## D1B - Implement the first playable vertical slice
STATUS: NEXT / ACTIVE
Use the existing Kelplantis runtime. Implement only the missing pieces required by D1A: avatar/Sigil choice, Sanctuary/Altar flow, starter weapon, Floor 1 encounter, telegraph, Guard/Parry, Channel Sigil, Tide-Glyph reward, inscription +10 Max HP, Save/Reload, and the Floor 2 gate preview.
Proof required: runtime execution evidence for all four D1A acceptance tests.

## D2 - Make the player state canonical
STATUS: STAGED
Reconcile client/runtime state with the existing Kelplantis player persistence layer. Define the authoritative fields for Sigil, equipment, HP, XP, shards, inventory, Soul Tome inscriptions, floor state, and save/load state. Do not create duplicate ownership systems if an existing canonical layer already covers the requirement.
Proof required: create/save/load round-trip with state equality.

## D3 - Make the Soul Tome a real progression system
STATUS: STAGED
Turn the first glyph into the smallest reusable inscription mechanism. Support empty slots, owned glyphs, inscription, stat effects, and visible confirmation. Keep the system generic enough for later glyphs without building a full item economy.
Proof required: glyph ownership -> inscription -> stat mutation -> persistence.

## D4 - Build the Floor 1 combat foundation
STATUS: STAGED
Generalize the first encounter into a small deterministic combat framework: enemy intent, telegraph, Strike, Guard/Parry, Channel Sigil, damage resolution, defeat, victory, and non-punitive Floor 1 death.
Proof required: repeatable combat test covering win and death paths.

## D5 - Give the three Sigils meaningful identity
STATUS: STAGED
Make Tide-Stalker, Coral-Guard, and Spore-Weaver mechanically distinct inside the existing Floor 1 loop. Do not balance the entire game yet.
Proof required: each Sigil changes at least one observable combat/progression outcome and persists through reload.

## D6 - Make Floor 1 a complete replayable session
STATUS: STAGED
Add the minimum loop for repeated runs: enter trial, encounter, reward, extraction, Sanctuary return, inscription/progression, save, and replay. Preserve Floor 1 as a safe PvE learning environment.
Proof required: two consecutive sessions with persistent progression and no state corruption.

## D7 - Add the first real content layer
STATUS: STAGED
Introduce a small curated set of additional Floor 1 encounters, rewards, and environmental choices using the existing content/event infrastructure. Focus on replayability, not quantity.
Proof required: multiple deterministic content paths and valid state transitions.

## D8 - Build the avatar identity layer
STATUS: STAGED
Connect player identity, avatar presentation, equipment, inventory, progression, and Soul Tome state into one coherent avatar lifecycle. Reuse existing player tables and client-build artifacts where appropriate.
Proof required: new avatar -> progression -> reload -> same identity/state.

## D9 - Establish the Floor 2 boundary
STATUS: STAGED
Design and implement only the gateway boundary needed to make Floor 2 meaningful: explicit PvP warning, risk disclosure, unsealed-item rule, and transition contract. Do not build the full 100-floor tower yet.
Proof required: Floor 1 safe-state -> explicit consent -> Floor 2 entry state.

## D10 - First-player observation build
STATUS: STAGED
Prepare a stable build suitable for one real human playtest. Capture only useful behavioral evidence: time to action, completion/drop-off points, combat comprehension, death/retry behavior, reward comprehension, save/load confidence, and desire to approach Floor 2.
Proof required: reproducible build plus observation record. No invented user feedback.

## D11 - First-player refinement
STATUS: STAGED
Use actual observation from D10 to fix the largest verified friction point. No speculative feature expansion.
Proof required: before/after evidence tied to the observed problem.

## D12 - Cosmetic foundation
STATUS: STAGED
Only after the playable identity/progression loop is stable, define the smallest cosmetic ownership and presentation loop using the existing commerce/ownership substrate where appropriate. Do not create a second canonical ownership model.
Proof required: cosmetic catalog -> owned cosmetic -> equip -> visible result -> persistence.

## D13 - Soul Tome collection depth
STATUS: STAGED
Expand glyphs/fragments into a small collection/progression layer driven by actual gameplay rewards. Keep the first set intentionally small.
Proof required: at least one complete multi-item collection loop without breaking canonical state.

## D14 - Floor 2 prototype
STATUS: STAGED
Build the smallest playable PvP-risk prototype, including death consequences and item-loss rules, only after D9's boundary is proven.
Proof required: explicit entry -> PvP encounter -> death/consequence -> persistent result.

## D15 - Tower/content expansion gate
STATUS: STAGED
Before expanding toward the 100-floor tower, run a Gauntlet decision using actual play evidence. Promote, refine, or kill the expansion based on evidence rather than architecture ambition.
Proof required: decision record with observed evidence and explicit gate outcome.

## Operating Rule

Gemini supplies player-experience clues where useful. The repository is the implementation record. Supabase is used for authoritative runtime state and evidence where required. No design artifact is treated as implemented until runtime evidence exists. No future domino is executed merely because it is written down.
