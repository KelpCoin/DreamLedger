# DreamLedger Commercial Gate Audit

Date: 2026-08-26

## Current truth

Source homepage: PASS.
Homepage checkout: PASS, NZD 29 one-time Stripe Payment Link.
GitHub Pages workflow: repaired and committed.
Public dreamledger.org: FAIL for desired state at audit time. Live response still identifies as "Dream Ledger Deck" rather than the canonical MTG homepage.
Customer revenue: UNPROVEN from this audit. No payment classification was performed here.

## Important correction

The Pages workflow contained a stale content assertion for "MTG / isolated silo" that did not match the current canonical homepage. That assertion has been corrected to the actual homepage marker "MTG / COMMANDER / ONE-TIME PURCHASE".

## Commit

7dd2697cd18bdf4058e474d72ce85f580d64038d

## Economic gate

No further architecture work is authorized by this artifact. The remaining infrastructure issue is deployment/domain convergence. Once the public page is correct, the next experiment is buyer acquisition and payment evidence.

## Verification

1. GitHub Actions: run the DreamLedger GitHub Pages workflow and require green build + deploy verification.
2. Public URL: https://dreamledger.org must show "Make your deck make sense." and "Commander Deck Diagnostic".
3. Checkout: primary CTA must resolve to the NZ$29 Stripe Payment Link.
4. Revenue: only Stripe customer payment evidence changes the commercial state from UNPROVEN to PROVEN.
