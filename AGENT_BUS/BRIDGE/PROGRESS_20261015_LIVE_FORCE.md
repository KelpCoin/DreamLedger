# GROK LIVE PUSH — V21

## Status
- GitHub `main` has cash board, home NZ$3.99 CTA, shop Pay on Stripe, MTG master.
- Live dreamledger.org may lag until Render deploys.
- `/buy/*` Stripe redirects WORK on live today.

## Required human action
Render → dreamledger-storefront → **Manual Deploy → Deploy latest commit**.

## Verify after deploy
1. GET /version includes release 2026-10-15-v21 OR header marketplace-v21
2. GET /cash.html = 200
3. GET /mtg/ contains See the cards
4. Home primary CTA contains NZ$3.99
5. GET /RELEASE_V21.json = 200

## First dollar (works without deploy)
https://dreamledger.org/buy/DREAMMEEZ-SUPPORTER-SPROUT
