# RIVET × DreamLedger B2B integration

**Updated:** 2026-09-30

## What RIVET means here

**No RIVET module in DreamLedger repo** (code search: 0).  
Reference pattern: [Rivet — Workspace for B2B Transactions](https://www.rivet.technology/) — shared buyer/supplier workspace (orders, invoices, approvals, payments, audit) instead of email/spreadsheets.

We borrow the **lifecycle pattern**, not their brand/product.

| Rivet-style idea | DreamLedger |
|------------------|-------------|
| One transaction workspace | correlation / proof across offer→pay→fulfil |
| Replace email chaos | listings + RFQ + status (Phase B/C) |
| Approvals | gauntlet + business verify badge |
| Payments | Stripe platform SKUs; peer external until Connect |
| Audit trail | ledger notes + Stripe receipt ids |

## Ebook spine (operator guide)

1. Positioning — NZ MTG/retro/vinyl · 0% success fee  
2. Roles — public / seller / verified business / operator  
3. Money — plans $49/$99 · slots · audits $29 · kits $99  
4. Lifecycle — discover→require→offer→approve→pay→fulfil→accept→proof→reconcile  
5. Phases A/B/C  
6. Scripts — RICH-OPERATOR-DAILY  
7. Anti-patterns — full TM clone, crypto-TCG, bridge-as-revenue  

## Planned SKU

`B2B-MARKETPLACE-PLAYBOOK-001` · NZ$39 PDF · bootstrap via Seller Audit $29 until Stripe link exists

## Surfaces

`/b2b.html` · `/fees.html` · `B2B-MARKETPLACE.md`

**Human still must:** unsuspend host · outbound · Stripe links
