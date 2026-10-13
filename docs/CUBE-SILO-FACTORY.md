# CUBE Silo Factory

CUBE creates a silo candidate from one versioned manifest. The factory generates the route, root/public mirrors, isolated catalogue, legacy alias, registry and fee-policy registration, and active-silo directory. TCG clones are generated from public/data/tcg-swarm.json and a shared template. Do not hand-create near-identical silo pages.

Run the one-command factory with npm run silo:compile. Run npm run verify:silo-factory, npm run verify:music-media, npm run verify:mtg-gauntlet, and npm run verify:tcg-swarm-gauntlet before release.

For a new non-TCG silo, add one manifest under silos/<slug>/silo.json, then run npm run silo:compile -- --manifest silos/<slug>/silo.json.

Invariants:
- MTG alone has a 0 bps platform fee. Every non-MTG silo resolves to 500 bps server-side.
- Empty catalogue means no approved listings, not inventory or demand evidence.
- A Buy control requires a verified Stripe Payment Link plus verified rights and delivery state. Unknown means hold.
- Only registry entries with status=active appear in the active marketplace directory.
- Root/public mirrors must match. Generated-file drift fails verification.
- TCG clones remain discovery/intake surfaces until real listings, seller checks, payment, and fulfilment evidence exist.
- Manifest values must be rendered through DOM APIs or escaped text, never concatenated into HTML.
- Public promotion remains subject to Gauntlet and the authorized release gate.

Current holds: the public MTG catalogue contained a direct Payment Link different from the canonical approved offer, so the direct public link is disabled pending live Stripe read-back. The singles form stores drafts in browser localStorage and does not prove backend publication. No settled-and-fulfilled order is claimed. Structural PASS is not revenue PASS.
