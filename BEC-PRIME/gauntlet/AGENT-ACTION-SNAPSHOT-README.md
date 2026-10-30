# BECK Gauntlet: Agent Action Verification Snapshot (private pilot)

This is an extension inside existing BEC-PRIME/gauntlet, not a new API,
scorecard authority, payment provider, factory or production transaction gate.

## What it verifies

One sanitized customer-supplied JSON action against seven versioned checks:
schema, unique identities, minor-unit amount and currency, tenant scope,
attached evidence bytes and hashes, replay and timestamp consistency in
provided history, and declared acceptance criteria.

The output includes PASS, QUARANTINE or FAIL, seven rule outcomes,
input hash, semantic output hash, and explicit unverified limitations.
PASS only states the submitted local fixture meets its local rules.
It does not prove provider authenticity, legal compliance, consent,
production safety, or occurrence of a transaction.

## Run and verify (private, no money or external action)

    node --test BEC-PRIME/gauntlet/AgentActionSnapshot.test.js

Tests use fake actions and temporary evidence files. They never contact Stripe,
publish a page, contact buyers, or change the economic ledger.

## Evidence boundaries

Gauntlet may write append-only evidence-envelope/v1 artifacts to an explicitly
supplied private directory using no-overwrite exclusive file creation and
SHA-256. The envelope hash excludes its own hash and integrity fields.
Only Elohim may write official scorecards. This module never writes one.

Local exclusive file creation does not by itself supply atomic cloud
transactions, independent authentication, backup, or legal audit integrity.
Production ingestion requires restricted durable storage and verified origin.

## Commercial gates

NZ$499 is a testing hypothesis, not a measured market price or approved live
SKU. One bounded verification output is the prospective deliverable.
No new live payment link, domain, advertisement, automated outreach or hosting
expense is authorized by this private source branch.

Price validation requires an independent interested buyer, observed human
and compute cost, a delivered artifact and genuine provider payment evidence.
Never label a synthetic fixture, CI pass or active link as commercial revenue.

Keep unrelated business silos separate. Standalone Quote Compare stays under
Truth Oracle and is not an acquisition priority.

Private pilot is technically proven only if exact PR HEAD passes focused CI;
it is not commercially validated by the tests alone.
