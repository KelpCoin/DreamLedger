# Phin Haven Client Adapters

The canonical world is engine-neutral. The web Canvas client is the reference implementation.

## Adapter targets

- Godot 4.x: GDScript adapter over PHINHAVEN-CLIENT-1.0.
- Unity: C# adapter over PHINHAVEN-CLIENT-1.0.
- Unreal Engine 5.x: C++/Blueprint-facing adapter over the same contract.
- Roblox: Luau adapter/experience integration where Roblox networking, identity, commerce, and platform rules permit.
- Native iOS/Android/Desktop: HTTP/WebSocket client over the same contract.

## Rules

1. Supabase remains authoritative for persistent game state.
2. Clients render and request actions; they do not create alternate economic truth.
3. DreamMeez identity and cosmetic ownership are portable identifiers, not engine-specific assets.
4. DOOH placements are published world content exposed through the world-surface contract.
5. CUBE remains a sidecar. It may observe normalized game/economic signals and serve approved economic data, but it does not own gameplay state.
6. A new client must pass the same gameplay contract tests before being treated as compatible.

## Portability strategy

Implement adapters, not forks. Keep game rules, identity IDs, cosmetic IDs, billboard placement IDs, and event schemas stable while replacing only the renderer/input/runtime layer.
