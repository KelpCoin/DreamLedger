# BECK Day 1: Security Boundary Reduction Receipt

Date: 2026-09-08

## Before

The live public schema inspection found 33 SECURITY DEFINER functions in `public`, with 21 executable by `anon` and 21 executable by `authenticated`.

`revenue_catalog` also granted mutation privileges to both `anon` and `authenticated`, despite the catalog being a source of economic truth.

## Changes applied

- Restricted sensitive economic SECURITY DEFINER functions including model-task claiming, economic-task enqueueing, economic assessment recording, and internal trigger functions from `anon`/`authenticated`.
- Granted the internal model-task/assessment functions to `service_role` only.
- Removed INSERT/UPDATE/DELETE/TRUNCATE on `revenue_catalog` from `anon` and `authenticated`; public roles retain SELECT only.
- Added append-only enforcement for `event_ledger`, `truth_oracle_evidence`, `truth_oracle_runs`, and `revenue_fossils`.
- Removed UPDATE/DELETE/TRUNCATE privileges on those append-only tables from `service_role`.
- Existing game-facing Kelplantis RPCs were not blindly revoked because they are intentional presentation/control surfaces and require separate token-bound security review.

## After

Live inspection now reports 34 SECURITY DEFINER functions, with 13 executable by `anon` and 13 executable by `authenticated`.

The reduction is from 21 public definer callables to 13, while preserving the existing intentional game RPC surface.

`revenue_catalog` now exposes SELECT to public roles without mutation privileges.

## Boundary

This is measurable hardening, not a claim that the entire Supabase project is secure. Broader RLS/policy debt and remaining public SECURITY DEFINER functions still require review.

## Next

Continue tightening only where the access model is known, while preserving the working Kelplantis client contract. Economic admission remains closed until Oracle + Gauntlet + exact-SHA CI evidence exists.
