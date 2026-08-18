# DreamLedger CI/CD Canonical Release Contract

Date: 2026-08-19

## Objective

Make production deployment a deliberate release event rather than an accidental side effect of every commit.

## Contract

1. Normal pushes run source, commerce, silo, authentication, and production-readiness verification.
2. Vercel production deployment is manual and fail-closed.
3. The production release workflow checks the VERCEL_TOKEN before any Vercel mutation.
4. The workflow creates or reuses the `dreamledger` project under team `team_HNsRrUI7JZV4iwejNlqJjXvR`.
5. The workflow pulls production configuration and verifies the required Supabase server-side variables exist.
6. Vercel Build Output is produced in GitHub Actions with `vercel build`.
7. Production deployment uses `vercel deploy --prebuilt`, so the Vercel platform does not rebuild the source artifact.
8. The deployment is not considered successful until the deployment URL returns HTTP 200 for `/` and HTTP 200 for `/api/account/me` with an anonymous session.
9. The canonical domain `https://dreamledger.org/` is probed separately.
10. A JSON proof artifact is uploaded containing the triggering SHA, deployment URL, HTTP results, and domain result.
11. No proof is labelled production-verified merely because a CLI command exited successfully.

## Economic gate

The deployment contract is necessary but not sufficient for revenue. The next economic proof remains:

`production HTTP -> account persistence -> checkout -> signed payment event -> settlement record -> verified money`

## Current blocker

The live GitHub status for the current main commit reports both Vercel checks failing with `upgradeToPro=build-rate-limit`. The release workflow therefore must not be spammed with retries. The build must be moved to GitHub Actions and deployed prebuilt once the Vercel deployment gate is available.

## Evidence boundary

This document records the intended release contract. It does not claim that production deployment, authentication, payment, or revenue has passed.
