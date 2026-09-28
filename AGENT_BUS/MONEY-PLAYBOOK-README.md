# Money Playbook (Canonical)

Agents and operators: **read this before inventing new money work.**

| File | Role |
|------|------|
| `MONEY-PLAYBOOK-INDEX.json` | Live buy routers + this-week order |
| `MONEY-PLAYBOOK-500.md` | Full playbook entry + rules |
| `MONEY-PLAYBOOK-500-part2.md` | Paths 251–500 |
| `BRIDGE/outbox/2026-09-28-money-playbook-canonical.json` | Bridge ping |

## Rule
Architecture does not put money in the bank. **Stripe livemode does.**

Priority: LIVE_LOOP paths → DIST posts → fulfil → proof → CUBE clone.
