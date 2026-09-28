# TRAVERSABLE OPPORTUNITY DISCOVERY V1

Date: 2026-09-29
Function: traversable-opportunity-discovery
Supabase project: wbwgroygjeyukkspnqiy
Deployment: ACTIVE v1
Deployment SHA256: be5413ba40dc0ccd8f228f85c6190a253876135baea5578e7c3f653b2a751cb8

Live-source adapters:
- New Zealand Government Electronic Tenders Service (GETS)
- GitHub public issues API

Hard rules:
- GET-only discovery endpoint
- no database mutation
- no outreach
- no submission
- no payment
- no revenue claim
- UNKNOWN never becomes PASS
- only the full traversability gate can produce TRAVERSABLE
- n8n is not a source

The deployment was accepted by Supabase and is ACTIVE. A direct runtime invocation from this environment could not be completed because outbound DNS/network access is unavailable and the connected browser is not active. Therefore this file does not claim a live function-run result.

Independent live source evidence observed during implementation:
- GETS current-tenders index is publicly observable and states that registration is required for login, detailed downloads, responding to tenders, and notifications.
- Current GETS search evidence included multiple active RFx records.
- GitHub public issue evidence included current open issues carrying help-wanted / good-first-issue signals.

This proves source availability, not economic conversion.
