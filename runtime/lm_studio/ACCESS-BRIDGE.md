# BECK Access Bridge (NZ)

A privacy-first service-navigation helper for healthcare, disability-service access,
urgent-cost support, and legal-aid routing. Designed to reduce repeated explaining,
lost follow-ups, and uncertainty about the next concrete step.

## What it does
- Returns a curated directory of official NZ routes.
- Produces an editable, plain-language request draft and a short follow-up checklist.
- Supports Bay of Plenty and Waikato routing.
- Exposes draft preparation through the existing read-only BECK MCP server.

## What it deliberately does not do
- No diagnosis, legal advice, eligibility decision, or promise of acceptance.
- No automated calls, emails, applications, complaints, public posts, or submissions.
- No database, Notion, Airtable, or cloud persistence of personal or health information.
- No secrets, case IDs, or personal records in fixtures or logs.
- No generated draft can mark a service contacted, application accepted, appointment booked, or outcome resolved.

## Current routes (recheck before use)
- Emergency medical danger: 111.
- Healthline: 0800 611 116, free and available 24/7: https://www.healthline.govt.nz/
- Nationwide Health & Disability Advocacy Service: 0800 555 050, weekdays 8:30am-5pm: https://advocacy.org.nz/contact-an-advocate-now/
- Legal Aid Services: 0800 253 425: https://www.justice.govt.nz/courts/going-to-court/legal-aid/contact-legal-aid/
- Baywide Community Law (Tauranga): 0800 905 916; (07) 571 6812; tauranga@baywidecls.org.nz: https://communitylaw.org.nz/centre/tauranga-whakatane/
- Community Law Waikato: 0800 529 482: https://communitylaw.org.nz/centre/waikato/
- Work and Income urgent-cost support: 0800 559 009: https://www.workandincome.govt.nz/products/a-z-benefits/special-needs-grant/index.html
- Disability Allowance: up to NZ$82.85/week as at 1 April 2026 for eligible ongoing costs; actual entitlement depends on circumstances and eligible expenses. Check current rules with Work and Income: https://www.workandincome.govt.nz/eligibility/health-and-disability/phones

## Run tests
From runtime/lm_studio: python -m unittest test_access_bridge.py

## Follow-up loop
The user or an authorised support person keeps a private local record of: service, date contacted,
reference number, requested documents, response due, next action, and whether a human confirmed
the outcome. Do not mark any state complete from a generated draft or model assertion alone.
