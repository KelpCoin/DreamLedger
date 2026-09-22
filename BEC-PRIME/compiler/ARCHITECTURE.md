# BEC Compiler Architecture

## Problem

dreamledger.org was **manually composed**. That does not scale to many faces and many loops.

## Target

```
Catalog (products, offers, approved)
  + Silo registry
  + Economic loop registry
  + Face registry
  + Sentinel aggregates (optional)
       │
       ▼
   BEC Compiler
       │
       ├── faces/*.html or face manifests
       ├── CTA card sets per face
       ├── agent-commerce.json slices
       └── loop-stubs.json
```

## Principles

1. **Source of truth is structured data**, not hand-edited marketing HTML  
2. **Approval gates** remain: compiler never auto-enables checkout without approved offer  
3. **Silo isolation** enforced in emitted surfaces  
4. **Air-gap**: compiler runs offline on local checkout of the repo  
5. **Idempotent**: same inputs → same content hash  

## Stages

| Stage | Input | Output |
|-------|--------|--------|
| Ingest | registry JSON, catalog | normalized graph |
| Gauntlet filter | candidates | pass/fail (not revenue) |
| Loop bind | approved + payment config | live vs stub loops |
| Face emit | face registry + CTA rules | surface manifests |
| Proof attach | settlement fossils | meter fields only if verified |

## What exists today

- `economic-loops/compile-loop-stubs.js` — stub compiler  
- `catalog/AutoRevenueCatalog.js` — historical pack generator (do not treat as live revenue)  
- Manual `public/index.html` — **legacy face**  

## Next compiler work (ordered)

1. Emit CTA card JSON from silo registry + live loops  
2. Emit per-face `agent-commerce` slices  
3. Replace manual market sections with compiled partials  
4. Never auto-post or auto-spend  
