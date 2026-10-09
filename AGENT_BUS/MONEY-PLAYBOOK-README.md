# Money Playbook (Canonical)

Agents and operators: **read this before inventing new money work.**

| File | Role |
|------|------|
| `MONEY-PLAYBOOK-INDEX.json` | Live buy routers + this-week order |
| `MONEY-PLAYBOOK-500.md` | Full playbook entry + rules |
| `MONEY-PLAYBOOK-paths-001-100.md` | Paths 1–100 |
| `MONEY-PLAYBOOK-paths-101-200.md` | Paths 101–200 |
| `MONEY-PLAYBOOK-paths-201-300.md` | Paths 201–300 |
| `MONEY-PLAYBOOK-paths-301-400.md` | Paths 301–400 |
| `MONEY-PLAYBOOK-paths-401-500.md` | Paths 401–500 |
| `BRIDGE/COMMERCIAL_ROUTES_CATALOG.md` | Supplemental 600 route hypotheses, not validated offers |
| `BRIDGE/outbox/2026-09-28-money-playbook-canonical.json` | Bridge ping |

## Rule
Architecture does not put money in the bank. **Stripe livemode does.**

Priority: verify existing live loop → prepare one permitted distribution test → human authorization → fulfil → independent proof → CUBE clone. Legacy distribution steps never override the current authorization gate.
