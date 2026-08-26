# Inverse Shopping Economic Loop

The machine has one job: convert a customer's WANTED request into an auditable candidate report, then convert paid demand into repeatable fulfilment.

## Loop

WANTED -> approved source -> live hunt -> candidate normalization -> factual evidence -> proof -> payment -> fulfilment -> repeat/referral

## Current gate

eBay Browse API is the only live marketplace adapter. The adapter uses application OAuth and `deliveryCountry:NZ`. No browser scraping, CAPTCHA bypass, rate-limit evasion, purchasing, or bidding is enabled.

## Truth boundary

A live eBay response proves source feasibility only. A Stripe settlement event is required before revenue is recorded. A fulfilment proof is required before a paid request is marked complete.

## Money ladder

1. G0-G3: prove the machine can find and evidence an object.
2. G4: sell one sourcing request.
3. G5: fulfil it cheaply and reliably.
4. G6: repeat until acquisition and fulfilment economics compound.

## Operator load

Biggie approves public activation and any external purchase. The machine performs intake, search, normalization, evidence capture, proof generation, payment observation, and fulfilment-state bookkeeping.

## Payment contract

The intended live surface is a one-time Stripe Payment Link. The canonical URL is supplied through `INVERSE_SHOPPING_PAYMENT_LINK`; the repository must never fabricate a payment URL. Until a real Stripe settlement event is observed, `commercial_signal` and verified revenue remain unproven.

## Verification

From `C:\BrownEyeCortex\DreamLedger`:

```powershell
Set-Location C:\BrownEyeCortex\DreamLedger\BEC-PRIME
npm run verify:wanted
npm run verify:hunt
npm run verify:wanted-proof -- D:\BrownEyeCortex\InverseShopping\proof\WANTED-HUNT-PROOF-<file>.json
```

Live evidence:

```powershell
Set-Location C:\BrownEyeCortex\DreamLedger
.\BEC-PRIME\scripts\Invoke-WantedHuntProof.ps1 -Live
```
