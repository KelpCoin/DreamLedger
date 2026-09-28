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
- no database mutation by the discovery function
- no outreach
- no submission
- no payment
- no revenue claim
- UNKNOWN never becomes PASS
- only the full traversability gate can produce TRAVERSABLE
- n8n is not a source

Deployment proof:
- Supabase accepted the function and reports ACTIVE v1.
- Direct runtime invocation from this environment could not be completed because outbound DNS/network access is unavailable and the connected browser is not active. This proof therefore does not claim a successful function invocation.

Independent live-source evidence:
- GETS current-tenders index is publicly observable and states that registration is required to log in, download more detailed information, respond to tenders, and manage notifications.
- Current GETS evidence observed during implementation contained multiple active RFx records, including RFx 34806438, 34768303, 34815673, 34533469, 34773009, 34820631, 34865131, 34456546, 34795867 and 33830698.
- GitHub public issue evidence included current open issues carrying help-wanted / good-first-issue signals.

Database observation batch:
- 10 genuine GETS observations were inserted into public.cube_opportunities.
- They are status DETECTED, not INTERESTING, SELECTED, APPROVED, or CONVERTED.
- All ten are explicitly marked discovery_gate=TRAVERSABILITY_PENDING.
- No price was observed, so expected_value_nzd is stored as the schema-required 0 with outputs.expected_value_status=UNOBSERVED. This is not a zero-value claim.
- No execution packet, buyer, payment, fulfillment, or external action was created.
- economic_outcomes remains 0.
- verified_external_revenue_nzd remains 0.00.

This is a real observation batch and a deployed discovery worker, not a claim of economic conversion.
