# MTG-backed silo clone factory

The MTG public shell is the canonical structural master for new silo shells. The factory clones its *structure and capability references*, not its domain inventory or commercial state.

## Contracts are linked, not conflated

- `silos/mtg/silo.json` uses `BEC-PRIME/CUBE-CLONE-MANIFEST/v1` and defines the public shell, isolation requirements, routes, and capability references.
- `ops/catalog/templates/silo-manifest.v1.json` uses `dreamledger/silo-manifest/v1` and gates candidate ingestion, evidence, Gauntlet status, Elohim changes, fulfillment, and product readiness.
- `ops/catalog/silos/registry.json` binds these contracts to the MTG master explicitly.

The clone generator fails closed if MTG is missing from the registry or any checkout/inventory defaults are relaxed.

## Plan only

```bash
npm run catalog:clone -- --slug music-media-lab --title "Music and Media" --currency USD
```

Without `--stage`, the command emits a plan and file paths only. It does not write files, deploy routes, publish offers, or call Stripe.

## Stage a shell

Choose an **absolute, empty directory outside the repository**:

```bash
npm run catalog:clone -- --slug music-media-lab --title "Music and Media" --currency USD --stage /tmp/dreamledger-music-media-stage
```

The output is a staging tree containing only:

- `public/silos/{slug}/silo.json`
- `public/data/{slug}-catalog.json` with `products: []`
- `public/{slug}/index.html` marked `noindex,nofollow`, with checkout disabled

Staging refuses to write into the repository, refuses a non-empty target, and never overwrites existing files. The generated public shell is not a deployable or commercially active silo. Review, route/fulfillment wiring, Gauntlet, publication approval, and independent end-to-end proof remain required.

## Scale rule

Use this sequence: factory tests -> one staged clone -> verify empty inventory and isolation -> route/fulfillment gates -> explicit publication approval -> independent paid outcome and delivery evidence. Do not bulk-clone public silos or create live payment links before the commercial truth gate has passed.

Run `npm run catalog:test` for the streaming catalogue and silo-clone checks.
