# Shared Avatar Subsystem

Dreamiez and Kelp Atlantis share one avatar asset graph. The avatar layer is not silo-local.

Every avatar, cosmetic, clothing item, armor item, accessory, emote, animation and avatar prop is authored against the shared asset contract. Its canonical `sku_id` and `canonical_asset_id` remain stable across both ecosystems.

Demand Radar and other ecosystem agents seed demand. Elohim Refinery produces and refines candidates. Gauntlet evaluates technical, visual, compatibility, provenance and commerce readiness. Approval Governor remains the final public-release gate.

The shared contract requires `target_ecosystems` to be `["dreamiez", "kelp_atlantis"]`. One canonical asset can therefore have multiple representations instead of becoming two duplicated products.

A shirt can be worn by the browser avatar and represented in-game. Armor can be represented in-game and worn by the browser avatar. The asset identity, provenance and SKU remain shared.

The browser foundation is Three.js plus `@pixiv/three-vrm`, using VRM/glTF/GLB representations. The surface is phone-first, browser-based and thumb-first. Horizontal rails are the default navigation primitive for catalogs and CTA tunnels.

CUBE remains the deployment pattern: canonical shared definitions feed silo skins, reskins, clones and splices without breaking canonical identity.

Lifecycle: DEMAND SIGNAL -> ELOHIM REFINERY -> CANDIDATE -> GAUNTLET -> APPROVED -> CATALOG -> OPTIONAL AUCTION/CHECKOUT -> RETIRED.
