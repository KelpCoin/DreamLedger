# Kelplantis Domino Roadmap

Status: FLEXIBLE_100_DOMINO_SEQUENCE

This roadmap is a portfolio of staged hypotheses, not a rigid build contract. The numbered order is the default path. Any domino may be reordered, split, merged, paused, or killed when runtime evidence, player observation, technical constraints, or commercial evidence says it should change.

Only the active domino may be executed. A written domino is not implemented until runtime evidence exists. Gemini is a research/review input where useful; the repository is the implementation record; Supabase is authoritative state/evidence where required; browser/runtime tests are the verification boundary.

North star:

`MAKE THE WORLD DESIRABLE BEFORE MAKING IT DANGEROUS.`

Product progression:

`HABBO HOTEL -> HARVEST MOON -> RUNE FACTORY -> DEEPER KELPLANTIS`

Commercial rule:

`IDENTITY / COSMETICS / STATUS MAY BE SOLD. POWER IS NOT SOLD.`

## DOMINOES 01-10: DEPTH 1 SOCIAL FOUNDATION

01. Compile a real browser-hostable Depth 1 runtime.
02. Create/load a DreamMeez identity.
03. Enter Depth 1 town.
04. Spawn around the Fountain without stacking.
05. Walk through the town.
06. See a genuine second client, not a fake NPC population.
07. Inspect another DreamMeez identity.
08. Proximity chat works between real clients.
09. Emotes are visible and social.
10. Prove the complete 7A loop in browser automation and two-client testing.

Gate A: Is the world genuinely playable for two people? If not, fix only the blocking causes.

## DOMINOES 11-20: PERSISTENT IDENTITY AND PLACE

11. Make player identity authoritative rather than local-only.
12. Persist avatar name and presentation.
13. Persist composite title.
14. Persist scars/behavioral marks without punitive item destruction.
15. Make the Soul Tome the permanent player anchor.
16. Implement logout presence with a limited protected Echo.
17. Rejoin at the authoritative saved location/state.
18. Add basic inspection summary for Soul Tome history.
19. Add the first personal-space/property container.
20. Prove identity + location + Soul Tome round-trip across logout/reload.

Gate B: Does the player feel like they exist in the world rather than merely control a session?

## DOMINOES 21-30: LIVING TOWN / FARMING / GATHERING

21. Add a small authored gathering zone.
22. Add the first gatherable resource.
23. Add inventory persistence.
24. Add the first simple farming plot.
25. Add planting.
26. Add growth/state progression.
27. Add harvesting.
28. Add one useful resource conversion.
29. Connect activities to Soul Tome history where meaningful.
30. Prove a complete living loop: plant/gather -> wait/act -> harvest -> persist -> return.

Gate C: Is there a reason to come back tomorrow without needing combat?

## DOMINOES 31-40: CRAFTING AND RESOURCE LOOP

31. Add the first craftable object.
32. Add a minimal recipe representation.
33. Add crafting station/container hooks.
34. Consume real gathered inputs.
35. Persist crafted outputs.
36. Add one refinement/conversion step.
37. Add item inspection.
38. Add basic durability/state only where useful.
39. Prevent duplicate ownership/inventory systems.
40. Prove gathering -> crafting -> ownership -> persistence.

Gate D: Does the economy of effort make sense before adding complexity?

## DOMINOES 41-50: GUILDS AND COMMUNITY

41. Create a guild.
42. Join/leave guild.
43. Give guild a persistent identity.
44. Add guild membership roles.
45. Add guild notice/message surface.
46. Add a minimal shared guild space.
47. Add guild-visible activity/history.
48. Add cooperative town goals without combat dependency.
49. Add guild cosmetic identity hooks.
50. Prove two or more real clients can form and use a guild state.

Gate E: Does the social graph create reasons to return with other people?

## DOMINOES 51-60: PLAYER ECONOMY AND COMMERCE

51. Define canonical player-owned resource state.
52. Add player-to-player trade proposal.
53. Add trade confirmation and cancellation.
54. Add a minimal marketplace/listing surface.
55. Connect listings to existing DreamLedger commerce substrate.
56. Add inventory reservation/settlement rules.
57. Add fulfillment/state transitions where physical or digital goods require them.
58. Add transaction history.
59. Add dispute/refund boundaries before real money use.
60. Prove one complete non-power economic loop end-to-end.

Gate F: Is the player economy real, auditable, and resistant to duplicated ownership?

## DOMINOES 61-70: FOUNDER IDENTITY AND COSMETIC COMMERCE

61. Define the first Founder identity layer.
62. Define the first cosmetic item.
63. Connect cosmetic ownership to the existing canonical commerce substrate.
64. Equip cosmetic.
65. Display cosmetic to other players.
66. Add Founder title/status.
67. Add limited Founder presentation without selling power.
68. Connect settled Stripe payment to ownership state.
69. Fulfill and verify a real external purchase without counting tests as revenue.
70. Prove payment -> ownership -> visible identity -> fulfillment -> evidence.

Gate G: Does commerce enhance identity rather than damage game balance?

## DOMINOES 71-80: OBSERVATION, RETENTION, AND REFINEMENT

71. Prepare a stable human playtest build.
72. Observe first-session time-to-action.
73. Observe where players stop or become confused.
74. Measure whether players inspect other identities.
75. Measure social interaction and return intent without inventing feedback.
76. Fix the largest verified friction point.
77. Improve mobile-first controls.
78. Improve town readability and creator-art presentation.
79. Remove dead UI and unused systems.
80. Run a Gauntlet decision using actual evidence.

Gate H: Continue, refine, or kill based on observed value. Do not expand merely because the architecture can.

## DOMINOES 81-90: LOCAL ADVENTURE AND PVE FOUNDATION

81. Add the first authored adventure area outside town.
82. Add gathering/adventure risk without making Depth 1 unsafe.
83. Add the first PvE interaction.
84. Add the first deterministic enemy encounter.
85. Add basic party formation.
86. Keep party size scalable rather than hard-coded to four.
87. Add first cooperative PvE reward.
88. Connect reward history to Soul Tome.
89. Add the first explicit deeper-region gate.
90. Prove town -> adventure -> reward -> return -> persistence.

Gate I: Does danger add value to an already desirable world?

## DOMINOES 91-100: DEEPER KELPLANTIS

91. Prototype Depth 2 as a distinct authored region.
92. Establish Depth 2's identity without forcing final lore prematurely.
93. Add the first party-based boss boundary.
94. Make boss party requirements scalable.
95. Add deeper-region progression state.
96. Add organized PvP only where explicitly designed, such as guild wars or duel arenas.
97. Add exceptional criminal/retaliation states without normal open-world PvP.
98. Use population and system readiness as gates for deeper sealed regions.
99. Run a full economic + gameplay + retention Gauntlet before large-scale depth expansion.
100. Decide whether Kelplantis earns the next 100 dominoes based on real player, technical, and commercial evidence.

Gate J: The next 100 are earned, not assumed.

## OPERATING RULES

- Dominoes are hypotheses with exit evidence, not promises.
- The active domino can change whenever evidence changes.
- Never fake population with autonomous NPCs to make a social metric look successful.
- Never call static code inspection runtime verification.
- Never count self-purchases, tests, simulations, or internal activity as revenue.
- Never sell combat power, progression power, scarce property, or economic advantage for cash.
- Creator Art remains canonical. Engine/System Design supplies functional containers and hooks.
- Supabase is used for authoritative persistent state and evidence where appropriate.
- Reuse the existing DreamLedger commerce substrate rather than creating parallel ownership/payment systems.
- Depth 1 is the product until Depth 1 proves it deserves expansion.
- The game must not become a substitute for the broader commercial work. It is one commercial surface inside the ecosystem.
