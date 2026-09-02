# Tri-Offer Market Test

Status: ACTIVE EXPERIMENT / NOT YET PROVEN

Test window: 7 days from first public distribution.

## Offers

| Offer | Price | Hypothesis | Primary audience | Checkout |
|---|---:|---|---|---|
| One-Minute Curiosity Pack | NZ$1 | Curiosity can create a low-friction first purchase | Curiosity / novelty / internet-discovery audiences | Stripe payment link |
| Quick Decision Kit | NZ$10 | Immediate utility can justify a small digital purchase | People actively seeking decision, planning, or productivity help | Stripe payment link |
| Landing Page Conversion Audit | NZ$29 | A concrete conversion problem is worth paying to diagnose | SaaS founders, indie hackers, small online businesses | Stripe payment link |

## Counting rules

A REAL CUSTOMER is an external person who is not the operator, a friend, a developer working on the project, or a test account, and whose live Stripe payment is independently verifiable as successful.

Revenue remains NZ$0 until that standard is met.

Do not count self-purchases, test-mode payments, refunded payments, duplicate webhook events, abandoned checkouts, clicks, likes, comments, promises, or estimated revenue.

## Scoreboard

| Metric | NZ$1 | NZ$10 | NZ$29 |
|---|---:|---:|---:|
| External impressions | 0 | 0 | 0 |
| Checkout visits | 0 | 0 | 0 |
| Click-through rate | UNPROVEN | UNPROVEN | UNPROVEN |
| Checkout abandonments | 0 | 0 | 0 |
| Successful external payments | 0 | 0 | 0 |
| Verified external revenue | NZ$0 | NZ$0 | NZ$0 |

## Definitions

CTR = checkout visits / external impressions.

Checkout abandonment rate = checkout sessions started but not successfully paid / checkout sessions started.

Verified external revenue = only successfully paid, externally attributable, non-refunded live transactions that can be independently reconciled to Stripe and the application's durable transaction evidence.

## Distribution test

Target at least 10 genuine prospects per offer where community rules permit. Record the source, post/thread URL, date, impression estimate or platform-provided reach, clicks, checkout starts, payments, and qualitative objections.

Do not spam communities. Participate only where commercial promotion is allowed and where the offer is directly relevant to an existing discussion or request.

## Kill / scale protocol

### If NZ$1 sells and NZ$10/NZ$29 do not

Conclusion: low-friction curiosity has demand, but paid utility/outcome has not yet been demonstrated.

Action: keep the NZ$1 experiment running, interview or observe buyers where possible, and change the NZ$10/NZ$29 value proposition or audience before increasing traffic.

### If NZ$29 sells and NZ$1 does not

Conclusion: concrete business outcome beats novelty for the tested audience.

Action: prioritize the NZ$29 offer, identify the exact problem buyers described, improve proof and delivery, and run a second distribution test to the same buyer type before broadening the audience.

### If NZ$10 sells and the others do not

Conclusion: immediate utility has demonstrated more purchase intent than novelty or the tested service positioning.

Action: identify the exact use case buyers paid for and build variations around that single job-to-be-done.

### If all three sell

Conclusion: multiple willingness-to-pay signals exist.

Action: compare verified conversion rates and fulfillment effort. Scale the offer with the strongest combination of purchase rate, customer value, and repeatability.

### If zero units sell after a serious 7-day distribution test

Conclusion: OFFER / DISTRIBUTION COMBINATION FAILED.

Do NOT conclude that Dream Ledger is dead.

Change exactly one major variable at a time in the next experiment:
1. audience,
2. problem,
3. offer promise,
4. price,
5. distribution channel,
6. landing-page framing.

Preserve the failed experiment as evidence. Do not erase or relabel it as success.

## Evidence gate

The experiment is not considered successful until the following exist for at least one external customer:

- live Stripe transaction ID
- successful payment status
- amount and currency match
- webhook/economic event evidence
- durable application record
- attributable offer ID
- external-customer qualification

Until then:

CODED: YES
CI PASS: UNPROVEN
DEPLOYED: UNPROVEN
LIVE VERIFIED: UNPROVEN
MONEY: NZ$0
