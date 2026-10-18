# Website as exhaust — started 2026-10-17

## Shipped
- `BEC-PRIME/compiler/face-registry.json` — structured face source of truth
- `BEC-PRIME/compiler/WebsiteFaceCompiler.js` — emits money + home + cash redirect
- Outputs → `public/` and `BEC-PRIME/compiled/website/`
- Proof → `BEC-PRIME/RUN-PROOFS/WEBSITE-FACE-COMPILER-PROOF.json`

## Run
```bash
node BEC-PRIME/compiler/WebsiteFaceCompiler.js
```

## Next
- Emit shop/mtg faces from catalog only
- Hook `bec website` → WebsiteFaceCompiler
- Render deploy so live serves exhaust
