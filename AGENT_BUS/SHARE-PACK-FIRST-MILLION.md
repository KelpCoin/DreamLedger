# Share pack — circulate live offers (first external payments)

**Updated:** 2026-10-06  
**Revenue rule:** NZ$0 claimed until independent external Stripe settlement + fossil.

## Canonical URLs (use these everywhere)

| Purpose | URL |
|---------|-----|
| **QR / share target** | https://dreamledger.org/go |
| Human tools page | https://dreamledger.org/toll-road |
| Direct NZ$9 (Evidence) | https://dreamledger.org/api/toll/v1/checkout/truth |
| Direct NZ$19 (Decision) | https://dreamledger.org/api/toll/v1/checkout/gauntlet |
| Machine manifest | https://dreamledger.org/api/toll/v1/manifest |

After deploy of this branch, `/go` is the single page with embedded QR + both buy buttons.

## QR
- Page-embedded QR points at `https://dreamledger.org/go`
- External generator (same data):  
  `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https%3A%2F%2Fdreamledger.org%2Fgo`

Print it. Post it. Put it on a sticker. One canonical destination.

## Short copy (paste-ready)

**One-liner**  
> Fixed-price automated tools. Evidence check NZ$9 · Decision check NZ$19. Pay → get the result. https://dreamledger.org/go

**X / short**  
> Need a bounded evidence or decision check? NZ$9 / NZ$19. Stripe settles before access. https://dreamledger.org/go

**Agent / API**  
> Manifest: https://dreamledger.org/api/toll/v1/manifest  
> Checkout: POST/GET …/checkout/truth or …/checkout/gauntlet

## Enterprise-grade distribution moves (do in parallel)
1. Merge + deploy discovery branch (homepage CTAs + /go)
2. Put QR on any physical surface you control
3. Pin /go in Discord, X bio, email signature, agent directories
4. After expansion branch deploys: 32+ scopes appear on manifest — density scales offers without new rails
5. Million independent payments = million independent people/agents completing Stripe — distribution, not more code alone

## What “hundreds of thousands of offers” means here
- Design target is already **200 000 roads** on one wall
- Expansion branch wires 32 scopes now; road factory + silo density fills the rest
- Each published road is a leaseable offer; CUBE still gates publish; revenue still only counts on settlement

## Do not
- Count checkout clicks as revenue
- Self-pay and mark verified external
- Invent “1M payments” progress without fossils

Get the QR and /go link in circulation. First independent NZ$9 is the scoreboard leaving zero.
