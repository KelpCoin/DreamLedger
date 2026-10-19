# DreamMeez

Identity + cosmetic layer for DreamLedger and PhinHaven.

## Current commercial focus

**Collection 001 — First Light** is the locked cash-register surface.

| File | Purpose |
|------|--------|
| `collection-001-first-light.json` | Canonical SKUs, prices, sets, rules |
| `CASH-REGISTER-001.md` | Acceptance checklist for first external sale |
| `GENERATION-PROMPTS-001.md` | Asset generation prompts (style-locked) |
| `SHOP-COPY-001.md` | Public-facing copy blocks |

## Goal

One independent buyer purchases a cosmetic and receives a durable entitlement that appears in inventory and can be equipped.

## Rules

- Free base DreamMeez always free
- No gameplay power sold
- Entitlements idempotent
- Self-payments are not external revenue

## Status

Catalogue locked 2026-10-19.  
Commerce rails (Stripe → owned_objects → inventory) are the remaining gate before soft launch.
