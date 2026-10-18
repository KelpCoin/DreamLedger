# Elohim enterprise design refinery

## Contract

`BEC-PRIME/design/enterprise.tokens.json` is the canonical shared design-token source. It follows the Design Tokens Community Group (DTCG) 2025.10 shape and is the only place for shared surface, text, border, spacing, typography, radius, and layout decisions.

`BEC-PRIME/compiler/DesignTokenCompiler.js` deterministically compiles that contract to `public/assets/dl-design-tokens.css`. Generated CSS is an artifact and must never be edited by hand.

## Compile and verify

```sh
node BEC-PRIME/compiler/DesignTokenCompiler.js --write
node BEC-PRIME/compiler/DesignTokenCompiler.js
```

The first command regenerates the CSS. The second is a read-only drift check used in CI. CI does not deploy the site, publish content, create inventory, or assert revenue.

## Design behavior

- Dark neutral surfaces and readable secondary text reduce glare while keeping content legible.
- Inter is the UI font; IBM Plex Mono is reserved for identifiers, evidence, and machine-readable values.
- Spacing follows a 4px base grid; layout uses consistent 8px multiples above the compact range.
- Borders, radii, typography, and surfaces use named tokens rather than per-page inventions.
- Silo manifests retain ownership of brand identity. MTG's existing gold accent remains its brand accent; shared system green is not allowed to overwrite it.
- Existing routes, catalog data, checkout logic, inventory, prices, and settlement truth are outside this visual-only change.

## Human boundary

Elohim owns deterministic token compilation and visual consistency. A digital proxy can propose a token change with evidence and tests, but cannot publish production changes, change payment logic, invent inventory, or bypass the repository's normal approval gate.
