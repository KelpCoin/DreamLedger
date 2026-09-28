# PUBLIC SURFACE GAUNTLET V3

Date: 2026-09-29

## Public rule
DreamLedger public pages must explain customer outcomes, not internal implementation.

Internal-only vocabulary includes the names of orchestration roles, control layers, authority ladders and internal databases. Those names must not appear in public navigation, headings, product propositions, marketing copy or public error messages.

Public vocabulary is limited to customer concepts: worlds, markets, offers, products, services, buy, sell, commission, orders, activity, evidence and transaction records.

## World catalogue
The public worlds page now reads from a public `/api/worlds` feed with pagination and search. It presents customer-facing world names and public world routes rather than exposing the internal database route as the primary customer URL.

## Evidence
The public evidence page explicitly separates recorded system activity from external economic outcomes. Current verified boundary remains 0 verified economic outcomes. No fabricated replay or footage is permitted.

## Production gate
Repository changes are not production proof. The live deployment must be inspected after deployment before the public-surface gate is marked PASS.

## Economic truth
Internal rows, execution packets, model responses, checkout availability and payment intents are not independently verified revenue. External settlement and fulfillment require independent evidence.
