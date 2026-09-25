# Lessons from Polsia research (2026-09)

## What Polsia evidence suggests

- Scheduled agents + Claude CLI + Postgres/Redis/Celery + Stripe integrations  
- Autonomy bounded by permissions, budgets, schedules, connected credentials  
- Customer remains merchant of record; Stripe processes payments  
- Terms disclaim guaranteed results  

## What DreamLedger should copy

**Pattern:** scheduler → specialized worker → tools/APIs → DB — not “AI company magic.”

## What DreamLedger should not copy first

Nine agents, ads, cold email, code generation, autonomous acquisition — **after** one verified external payment.

## DreamLedger differentiation

Stricter: authorization boundary, Stripe as payment oracle, economic_event only from verified evidence, LLM cannot mint truth.

## Shortest path (unchanged by Polsia)

Offer → landing → Payment Link → stranger pay → webhook verify → fulfil → economic_event.
