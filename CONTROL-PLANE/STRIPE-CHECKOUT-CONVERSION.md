# Stripe checkout conversion checklist

## Surface (done / maintain)

- [x] Primary CTA = price in button label (`Buy · NZ$29`)
- [x] Direct Payment Link (no extra hop when possible)
- [x] Trust row under first CTA (Stripe · one-time · time)
- [x] After-pay steps before legal anxiety note
- [x] Honest scope (no fake traffic promises)
- [x] Mobile sticky buy on billboard
- [x] Disabled CTA when checkout truly unavailable
- [x] Second CTA after benefits (billboard)

## Stripe Dashboard — Payment Links (operator)

For each live link (tile, diagnostic, kit, deck, NZ$1):

1. **Enable** Apple Pay / Google Pay / Link where available  
2. **Collect** only required fields (email + fields needed for fulfilment)  
3. **Success URL** → thank-you page with next steps (not bare home)  
4. **Cancel URL** → same product page with `?cancelled=1` soft message  
5. **Quantity** locked to 1 for unique inventory (deck, tile slots)  
6. **Promotion codes** off until first sale proven  
7. **Tax** only if required by NZ rules for that product type  
8. Confirm **live mode** links (not test) on production pages  

## Copy rules that convert without lying

| Do | Don't |
|---|---|
| Say what they receive | Promise traffic/ROI on tile |
| One-time price in CTA | Vague “Get started” |
| Manual fulfilment time band if known | Fake “instant” if manual |
| Human review for tile | Hide review until after pay only |
| NZ$ in label | Mixed currency confusion |

## Priority products for conversion tests

1. NZ$29 Diagnostic — primary  
2. NZ$50 Tile — sticky mobile  
3. NZ$1 Curiosity — only as friction test, don’t let it cannibalize diagnostic  
4. NZ$79 kit / NZ$400 deck — secondary  

## After first paid conversion

Record offer_id, amount, session in `PROOF/RA_000001-*.md`. Tune only the winning offer’s page next.
