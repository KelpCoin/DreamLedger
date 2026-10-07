# COMPOUNDING WIKI · 777 KNOWLEDGE COMPILE — 2026-10-07

**Status:** ACCEPTED AS INBOUND MECHANISM · NOT REVENUE  
**Scoreboard unchanged:** NZ$0.00 verified external revenue

---

## What is accepted

Karpathy LLM Wiki pattern (April 2026 gist): compile knowledge into a persistent interlinked markdown artifact instead of re-deriving via RAG every query.

Layers:
1. **Raw sources** — immutable (Stats NZ pulls, receipts, decklists, evidence fossils)
2. **Wiki** — LLM-maintained pages with [[wikilinks]], contradiction flags, synthesis
3. **Schema** — conventions (AGENTS.md / wiki rules)

Ops: **ingest → query → lint**

Applied to DreamLedger.org: each 777 cycle may **add or update one page that clears the value floor**, hash it, link it, deploy incrementally. The public site becomes a knowledge base that is also a discovery surface — not a brochure rebuild.

This is **Solution 3 (inbound)** from the distribution frontier. It does not replace key→wall commerce or human gates on outbound post.

---

## What is rejected / constrained

| Claim | Ruling |
|-------|--------|
| Month 6/12/24 traffic curves as DreamLedger forecast | **REJECTED** — other sites' case studies are not our evidence |
| "Website better" = money | **REJECTED** — money = settlement + fulfillment + independent proof |
| 10k thin programmatic pages | **REJECTED** — value floor; thin pages risk demotion |
| Compile without commercial spine | **CONSTRAINED** — every public page should link to a live door or explicit UNKNOWN |
| Owner does audits | **REJECTED** — machine compiles; owner only phone-sized gates |

---

## Value floor (publish gate)

Before any generated page ships:

1. **Unique substance** — not a template with swapped tokens  
2. **Source citation** — raw immutable source ID / URL / date  
3. **Evidence labels** — VERIFIED / UNVERIFIED / UNKNOWN / STALE where claims are economic  
4. **Reader loss test** — if deleted tomorrow, would a reader lose something specific?  
5. **Door or honest dead-end** — link to live buy/path **or** state no product yet

If the data only supports N pages above the floor, N is the ceiling.

---

## NZ signal feed (real)

Stats NZ Aotearoa Data Explorer API: `https://api.data.stats.govt.nz/rest/`  
Subscription key via portal.apis.stats.govt.nz. Free for published datasets.

Prefer datasets that connect to Truth Oracle / cost-of-living / NZ commerce questions already on `/overpaying.html` and `/truth-oracle.html`.

---

## Concrete cycle (one page)

```
TRIGGER (cron or manual)
  → FETCH one Stats NZ (or other) source
  → COMPILE one wiki page (hash sources)
  → LINT (orphans, contradictions, thin content)
  → LINK [[wikilinks]] to existing index
  → VALUE_FLOOR check → fail = do not publish
  → INCREMENTAL build/deploy only changed routes
  → RECORD artifact (SHA, source IDs, door links)
```

Do **not** require gh-aw as a blocker. Prefer smallest existing Actions path that can: fetch → write markdown under public/wiki or content/ → PR or commit if tests pass.

---

## Relation to money

```
Knowledge page (compounding asset)
  → organic discovery (maybe, months later)
  → visitor hits Truth Oracle / offer door
  → key purchase or Stripe settle
  → fulfillment
  → VERIFIED ECONOMIC OUTCOME
```

Until the last step, scoreboard stays NZ$0. Compile is capital formation for discovery — not a substitute for Patreon shop SKUs, cold-tested doors, or authorized outbound.

---

## Single next engineering action

1. Create `content/wiki/` (or existing public content root) + `index.md` + schema snippet in `AGENTS.md` or `docs/WIKI_SCHEMA.md`  
2. Manually or via one workflow: **one** Stats NZ–backed page that clears value floor and links to Truth Oracle  
3. Deploy; measure indexation later — do not claim traffic

Owner gate only if a new commercial claim is published as fact without evidence.

---

*Disk-first. Mechanism accepted. Projections not promoted to evidence. Cash-first rules still bind.*
