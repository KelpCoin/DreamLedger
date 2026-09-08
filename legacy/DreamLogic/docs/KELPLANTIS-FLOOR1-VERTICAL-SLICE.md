# Kelplantis Floor 1 Vertical Slice

Status: implementation contract
Date: 2026-09-08

## Objective

Turn the existing Kelplantis authoritative backend into one coherent player-facing Floor 1 loop. Do not build Floor 2 or MMO-scale networking yet.

## Player loop

ENTER -> AVATAR -> SOCIAL HUB -> ACTIVITY/QUEST -> EXPLORE -> DETERMINISTIC PVE -> DUNGEON -> FLOOR 1 BOSS -> AUTHORITATIVE CLEAR -> WORLD RESPONSE -> FLOOR 2 GATE

## Existing authoritative backend verified in live Supabase

- `kelplantis_create_player(p_name text, p_color_hue integer)`
- `kelplantis_enter_floor(p_token uuid, p_floor_id integer)`
- `kelplantis_move_player(p_token uuid, p_dx integer, p_dy integer)`
- `kelplantis_engage_encounter(p_token uuid)`
- `kelplantis_attack(p_token uuid)`
- `kelplantis_record_floor1_boss_clear(p_player_id uuid)`
- `kelplantis_get_floor_gate(p_token uuid, p_floor_id integer)`
- `kelplantis_get_floor_progress(p_token uuid)`
- `kelplantis_get_world_state(p_world_key text)`

The authoritative progression table is `public.kelplantis_floor_progression` with `player_id`, `highest_unlocked_floor`, `floor_clears`, and `updated_at`.

## Client requirements

The client should consume the authoritative routines rather than inventing local progression state.

Required player-visible surfaces:

1. Floor 1 entry screen.
2. Avatar/player identity.
3. Town/social hub.
4. Movement/exploration.
5. Encounter/combat feedback.
6. Progress state.
7. Boss state.
8. World-state consequence after Floor 1 clear.
9. Floor 2 locked/unlocked state.

## Security requirements

- Never expose a service-role or secret key in the browser.
- Do not bypass RLS.
- Do not trust client-side boss completion.
- Do not trust client-side floor unlock state.
- Do not let community mutation change deterministic combat rules.

## Community influence

The existing world-response system should be surfaced through one visible Floor 1 consequence. The consequence must be persistent and retrievable from authoritative state.

## Definition of done

A test player can enter Floor 1, move, encounter deterministic PvE, progress to the boss, legitimately clear the boss, observe the persistent world response, and receive an authoritative Floor 2 unlock. A forged client-side completion attempt must fail.

If the current repository does not contain the playable client implementation, do not fabricate one from screenshots or prose. Integrate the actual client once its repository/path is identified.
