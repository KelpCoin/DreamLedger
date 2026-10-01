# Apply findings: FB gatekeeping vs DreamLedger gaps

## Their failings (we weaponise)
- Posts **absorbed / buried / deleted / never approved**
- One-post rules, no real search
- Mod opacity and ban anxiety
- Stressful for a hobby that should be simple

## Our failings (we close)
| Gap | Fix applied / next |
|-----|--------------------|
| Empty searchable catalogue | `public/mtg-search.html` — filter by name, city, condition; seed + draft listings |
| Hard to list | `public/mtg-list.html` — template fields → free account |
| Weak vs “they have the crowd” | Seed real NZ stock; post in groups with link to searchable list |
| Deploy lag (.html 404) | Prefer routes `/mtg-search` `/mtg-list` when host maps public HTML |

## Their remaining advantage
**Liquidity + habit only.** Product answer: searchable permanence + 0% + fast list. Market answer: seed listings and show up where the 6k already are.

## Operator actions
1. Deploy `mtg-search` + `mtg-list`
2. List 20–50 real cards from own inventory
3. On FB posts: “Also searchable on DreamLedger — doesn’t vanish in the feed”
4. Keep $29 diagnostic as paid trust/tool wedge
