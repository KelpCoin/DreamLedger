# THIRD-PARTY SCRAPING GATE V1

Status: IMPLEMENTED

Purpose: make future third-party collection a source-by-source controlled operation rather than a generic scraper that assumes public means permitted.

## Admission

A source must carry evidence for:
- source URL
- terms URL and review timestamp
- robots check and timestamp
- automated-access verdict
- jurisdiction
- data classification
- retention rule
- provenance

UNKNOWN is not PASS.

## Preferred access order

1. Official API
2. Licensed feed or export
3. Explicitly permitted public endpoint
4. Public HTML GET retrieval where policy evidence supports it
5. Browser automation only when permitted and technically necessary

The pipeline must stop rather than bypass authentication, paywalls, CAPTCHAs, geo restrictions, anti-bot controls, rate limits, IP blocks, or other access controls.

## Privacy

Publicly accessible personal information is not treated as unrestricted data. Australian privacy guidance expressly says public availability does not by itself remove privacy obligations, and automated scraping can constitute collection of personal information. Collection must be lawful and fair, reasonably necessary, proportionate, and minimised. Sensitive information receives a stricter gate.

Source-specific projects therefore default to PUBLIC_NON_PERSONAL unless evidence establishes another classification. Personal data is minimised, purpose-bound, provenance-linked, and subject to a retention/deletion rule.

## Runtime controls

- per-source rate limiter
- retries with bounded exponential backoff
- source-specific headers/user-agent
- provenance on every record
- policy evidence snapshot
- change detection
- validation before export
- hard stop on policy/access failure
- no credential collection
- no secret storage in source configs

## Commercial boundary

This machinery prepares and executes permitted data collection. It does not itself create buyer authority, submit proposals, make payments, or establish revenue. A real buyer, permitted source, accepted deliverable, and independently evidenced external transaction remain separate gates.

## External reference

OAIC guidance updated 13 May 2026 states that publicly available personal information remains subject to the Australian Privacy Principles and specifically discusses web scraping, data minimisation, lawful/fair collection, and third-party collection arrangements.
