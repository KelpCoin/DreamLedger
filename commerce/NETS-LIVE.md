# NETS LIVE — DreamLedger commercial doors

**As of 2026-09-16.** Source: live Stripe + `https://dreamledger.org/api/offers`.
**Rule:** Revenue only after Stripe `succeeded`. This file is not a revenue claim.

Storefront: https://dreamledger.org  
Live `/version` commit at last probe: `b036bfe3…` (emergency deploy of `c4a94397…` failed: **empty** `RENDER_DEPLOY_HOOK_URL` / `RENDER_API_KEY` / `RENDER_SERVICE_ID`).

---

## Priority nets (copy → share)

### Digital identity / Garden
| Offer | NZ$ | Pay |
|-------|-----|-----|
| Cosmic Hoodie | 5 | https://buy.stripe.com/aFa14nd5XdSdeqH5oEdwc2J |
| Chrome Boots | 9 | https://buy.stripe.com/3cI5kDgi97tP3M37wMdwc2L |
| Cape | 10 | https://buy.stripe.com/cNi5kDaXP7tP0zR2csdwc2K |
| Supporter Sprout | 3.99/mo | https://buy.stripe.com/3cI5kDfe5cO9gyP5oEdwc2M |
| Supporter Glow | 5.99/mo | https://buy.stripe.com/5kQfZh5Dv9BXciz5oEdwc2N |
| Supporter Depth | 9.99/mo | https://buy.stripe.com/8x2dR93vnaG1gyPg3idwc2O |
| Floor 1 Access | 19 | https://buy.stripe.com/aFa3cvea16pLbevbN2dwc2P |

### Billboard / media (NZ)
| Offer | NZ$ | Pay |
|-------|-----|-----|
| Founding Billboard | 50 | https://buy.stripe.com/dRmbJ2cZi9eW4mk9La9oc02 |
| Founding (alt plink) | 50 | https://buy.stripe.com/aFa14naXP15r1DVdVadwc2B |
| Permanent 100×100 | 50 | https://buy.stripe.com/00w9ATaXP3dzaar9EUdwc2r |

### MTG liquidation
| Offer | NZ$ | Pay |
|-------|-----|-----|
| Commander Deck Diagnostic | 29 | https://buy.stripe.com/00w7sLaXP01n96nbN2dwc2l |
| CMD Diagnostic (marketplace) | 29 | https://buy.stripe.com/8x228r1nfg0l3M32csdwc2I |
| EDH_0001 physical deck | 400 | https://buy.stripe.com/14A3cvea1dSd1DV5oEdwc1J |
| EDH_0001 (marketplace plink) | 400 | https://buy.stripe.com/6oU28r0jbdSdciz04kdwc2E |

### Digital kits / services
| Offer | NZ$ | Pay |
|-------|-----|-----|
| Discord Webhook Starter Kit | 79 | https://buy.stripe.com/4gMcN56HzaG1dmDeZedwc1n |
| n8n Fixed-Price Rescue | 99 | https://buy.stripe.com/6oU28r7LD6pL4Q74kAdwc2z |
| Automation Reliability Audit | (plink) | https://buy.stripe.com/6oU28r7LD6pL4Q74kAdwc2z |
| Maximona Production Verification | 1500 | https://buy.stripe.com/dRmcN54zr29v2HZbN2dwc2C |

### Back-burner (Stripe product exists; do not lead with these)
Accounting diagnostic / AP-AR / AI bookkeeping / BEC audits / white-label — active in Stripe catalogue; keep secondary until capacity confirmed.

### Not nets yet
- Vinyl / music media silo — **no** live Stripe product found in active set
- Programmatic DOOH NZ$500 campaign — **gated** until fulfillment proven
- Full MTG collection SKU list — only EDH_0001 + diagnostic on live offers API

---

## Operator actions that actually cast nets

1. **Paste any Priority row** into Discord / Reddit NZ / TradeMe / FB Marketplace / email.
2. **MTG:** list EDH_0001 + diagnostic on TradeMe / Facebook MTG NZ groups with the Stripe URL (no fake stock).
3. **Billboard:** post Founding $50 with https://dreamledger.org/billboard .
4. **Render:** set repo secrets `RENDER_DEPLOY_HOOK_URL` or `RENDER_API_KEY` + `RENDER_SERVICE_ID` so emergency release can converge SHA.
5. **Vinyl:** photograph + one Stripe product + one payment link before claiming a music silo.

## Stripe truth (sample)
Live succeeded intents already exist (e.g. NZ$5). Do not zero the ledger in docs.
