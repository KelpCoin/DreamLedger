# Silo taxonomy — cells vs true silos

## Scale honesty

- **~1M cell-scale POC** (generator output) ≠ 1M businesses  
- **~500 true silos** = quality target: durable, public-safe, one CTA  
- **Money silos** ⊂ true silos; start with 3 live paid offers  

## Definitions

### Cell
Auto-spawned or experimental unit. May lack fulfilment, public copy, or payment path. Lives in sandbox / bulk tables.

### True silo
Promoted unit:

- `is_true_silo = true`
- `public_safe = true`
- Single clear CTA
- Fulfilment or explicit free path
- No ops/internal language on public pages

### Money silo
True silo + live Stripe (or free→upsell later) + evidence path into commercial ledger.

### Care silo
True silo aimed at household support, learning, play, identity — **must not** inflate revenue metrics.

## Promotion checklist

- [ ] Title human-readable  
- [ ] One CTA URL  
- [ ] Price or Free explicit  
- [ ] Fulfilment note  
- [ ] Public surface clean  
- [ ] Flagged true silo in Supabase/catalog  

## Demotion

If public leak, broken buy path, or abandoned → `archived` or back to `cell`.
