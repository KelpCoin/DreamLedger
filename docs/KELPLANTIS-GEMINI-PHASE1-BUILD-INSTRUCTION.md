# Gemini Build Instruction: Kelplantis Phase 1

Treat the repository and Supabase state as authoritative implementation context.

Build toward a fully playable Depth 1 Kelplantis MVP.

Kelplantis is an underwater social world. Phase 1 is intentionally small: one creator-authored town, DreamMeez avatars, social interaction, Soul Tome persistence, passive farming/gathering/crafting, and a functioning player economy. Deeper depths and boss systems are not the current build target.

Do not redesign the town visually. The creator supplies the art, architecture, layout, atmosphere and landmarks. Implement a functional spatial container around that authored world.

Required playable loop:

CREATE AVATAR -> ENTER TOWN -> WALK -> SEE/INSPECT DREAMMEEZ -> CHAT/EMOTE -> GATHER/FARM -> CRAFT -> TRADE -> LOG OUT -> SOUL TOME REMAINS -> RETURN

Use existing DreamMeez, Kelplantis player, Soul Event, cosmetics and commerce/persistence substrates where they already exist. Do not create parallel state stores without proving the existing substrate cannot support the requirement.

The Soul Tome is the physical logout anchor. Do not create a separate Soul Stone. A logged-out player's Echo is protected, limited and ambient, not a full autonomous bot.

Prioritize actual runtime behavior and verification over documentation. Every completed slice should leave working code, tests/proof, and persistent state where appropriate.

Phone-first interaction is required, with desktop support.

Do not fabricate players, revenue, purchases or economic outcomes. Test activity remains TEST/INTERNAL.

Definition of done for this phase: a fresh player can enter the Depth 1 town, move, socialize, inspect identity, perform passive living/economic activities, craft/trade, log out, return later, and recover authoritative state from Supabase without critical runtime errors.

Work in small verified increments. Inspect existing implementation before adding new architecture. Reuse existing tables and runtime hooks wherever possible.
