# First-sale execution pack (Ball C)

**Meter truth:** `verified_external_revenue_nzd = 0` until this pack closes with fossil.

**Human builder forbidden.** Agents prepare surfaces and evidence. An external buyer closes the sale.

## Objective

One stranger completes a live Stripe Checkout for an approved SKU. Settlement Sync records it. Fulfilment completes. Fossil is sealed. Meter moves only from that chain.

## Pre-flight (agents)

1. Run `REV-001` — plink inventory matches approved catalog.
2. Run `REV-002` — Settlement Sync honest zero.
3. Run `REV-003` — primary CTA is the single live plink.
4. Run `REV-004` + `REV-005` if not already proven (self-test only).

## Demand pulse (still human or approved automation only)

Owned channels only. No cold spam.

- Discord (Happy Homarid free tier / existing members)
- Facebook / Instagram / Linktree already pointing at the offer
- TradeMe if the SKU is physical or deck inventory
- One clear CTA: what they get, price in NZD, link

Do not invent buyers. Do not self-pay as “external.”

## Close criteria (L3)

| Step | Evidence |
|------|----------|
| Live Checkout completed by non-operator | Stripe session / Payment Intent id |
| Settlement Sync matched plink + amount | `proof/autonomy/latest-settlement-sync.json` |
| Fulfilment delivered or claimable | fulfil registry + claim proof |
| Fossil sealed | `proof/autonomy/latest-external-sale-fossil.json` |
| Meter | increments only after the above |

## Explicit non-claims

- Green CI is not a sale.
- Webhook self-test is not revenue.
- Architecture progress is not revenue.
- Provider migration is not revenue.

## After first fossil

Open `REV-012` (second pay, same path). Only then expand offers or silos.
