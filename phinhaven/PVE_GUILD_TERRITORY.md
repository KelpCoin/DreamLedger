# PhinHaven · PvE guild territory mechanics

Status: design contract (Stage 2+)  
Rule zero: **players never fight other players**.

All conflict is against the world / systems. Guilds compete by out-performing each other at PvE, not by killing each other.

## Loop

**Claim → Maintain with PvE → Defend by doing more/better PvE when challenged.**

## 1. Map & parcels

- The map is divided into fixed parcels (grid first; organic zones later).
- Each parcel is one of:
  - `open` — unclaimed
  - `claimed` — owned by a guild
  - `contested` — timed PvE event in progress

## 2. Claiming

- A guild spends resources + time, or completes a PvE objective, to plant a claim beacon on an `open` parcel.
- On success the parcel becomes `claimed` by that guild.
- Claim strength decays slowly if the guild is inactive (soft decay, not instant loss).

## 3. Holding / upgrading

Guild members raise a parcel’s **control score** by doing PvE *in or near* the territory:

- kill local monsters
- complete resource nodes
- build / upgrade structures
- farm or craft on the land

Higher control score → stronger claim + better passive benefits (yield, NPC services, rare spawns, etc.).

## 4. Contesting (the “guild war”)

- Another guild can start a **Contest** on a claimed parcel.
- Contests **do not** allow attacking players.
- A contest opens a time-limited PvE event on that parcel, for example:
  - waves of stronger monsters
  - shared resource nodes both guilds race for
  - objectives (destroy a construct, fill a progress bar, escort, etc.)
- Whichever guild contributes more effective PvE progress during the window keeps or takes the parcel.
- Losers get a cooldown before they can contest the same parcel again.

## 5. Supabase sketch (authoritative)

```text
parcels
  id, owner_guild_id, control_score, last_activity, status  -- open | claimed | contested

contests
  id, parcel_id, challenger_guild_id, defender_guild_id,
  start_time, end_time, challenger_score, defender_score, status

guilds
  id, name, ...

guild_members
  guild_id, player_id, role
```

- Realtime subscriptions update the map live.
- RLS: only guild members can act on their own claims; contest scoring is server-side / RPC.
- Client shows state; server decides outcomes.

## 6. What players should feel

- Your guild gets stronger by playing together (killing, gathering, building).
- You expand by out-performing other guilds at the same PvE content.
- No ganking, no corpse camping, no “logged in at the wrong time and lost everything” from other players.
- Territory still feels competitive because organised, active guilds win the land.

## 7. Optional later layers (still pure PvE)

- Stacking territory bonuses (farm yield, rare spawns, crafting stations)
- Seasonal soft resets so the map does not freeze forever
- Alliances (share some benefits without merging)
- World events that temporarily raise the value of certain regions

## 8. Non-goals

- Player-vs-player combat of any kind for territory
- Stealing inventory by attacking players
- Pay-to-win claim strength

## Related

- Stage placement: Stage 2 in `phinhaven/ROADMAP.md`
- Public surface: `phinhaven.html`
- Operating / commercial gates: `PHINHAVEN_MASTER_OPERATING_CONTRACT.md`
