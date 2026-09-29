# RIVET — DreamLedger B2B Transaction Layer

**Pushed from build-mode artifacts · 2026-09-30**

RIVET is DreamLedger’s **B2B transaction workspace** (build-mode name): marketplace, sell/buy, shop rails, auctions, trust, policies, silo seed.

## Lifecycle

Discover → Require → Offer → Approve → Pay → Fulfil → Accept → Proof → Reconcile

## Files

- `index.html` — enterprise landing
- `marketplace.html` — B2B marketplace shell
- `sell.html` / `buy.html` — seller & buyer entry
- `shop.html` — catalogue rails
- `auctions.html` — auctions
- `trust.html` / `policies.html` — trust & policy
- `news.json` — ticker
- `SILO-CELLS-SEED.json` — silo seed
- `B2B-MARKETPLACE.md` + `b2b-marketplace.json` — money model & phases

## Money

0% success fee on peer goods. Earn on plans, slots, audits, kits.
Ignition: `/buy/COMMANDER-DECK-DIAGNOSTIC-001` · `/buy/SELLER-PROFIT-AUDIT-001` · `/buy/DISCORD-WEBHOOK-STARTER-KIT-001`

## Deploy

Host was 503 Service Suspended at push time — restore hosting, then copy `RIVET/*.html` into `public/` or wire deploy to this folder.
