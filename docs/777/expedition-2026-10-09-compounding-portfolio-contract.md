# 777 Expedition: Compounding Portfolio Contract

**Date:** 2026-10-09  
**Status:** DESIGN / UNVERIFIED RUNTIME  
**Economic truth:** `VERIFIED_EXTERNAL_REVENUE = NZ$0.00`

## Purpose

Each 777 cycle must return either independently verified economic progress or one new, durable, non-duplicate component that improves DreamLedger. A green workflow is evidence of process execution, not proof of buyer demand, money, publication quality, SEO traffic, or market validation.

## Cycle receipt contract

A cycle receipt should record:

- Workflow run ID, trigger event, branch, head SHA, job conclusions, and timestamps.
- Source publisher, canonical URL, published/observed timestamps, and source-content hash.
- Stable deduplication key and the existing artifact(s) checked for collision.
- Candidate/offer identifiers grounded in the source and existing catalog.
- Elohim/model path actually used, including explicit fallback and endpoint-failure status.
- Gauntlet verdict and rejection reasons.
- Artifact path, SHA-256, publication state, and the exact public route if published.
- Economic truth fields for buyer, settlement, fulfillment, delivery evidence, and independent verification.
- A next bounded task, its owner/agent lane, base commit, acceptance tests, and handoff receipt.

Missing evidence stays missing. Never infer zero demand from a failed source. Never infer a buyer from a news headline. Never infer revenue from a checkout URL, internal/test payment, workflow success, model response, or artifact count.

## Artifact classes

1. **Raw observation:** immutable, source-linked, timestamped.
2. **Internal expedition artifact:** schemas, tests, decision records, source comparisons, or diagnostics. It is durable but is not automatically a public webpage.
3. **Public observatory page:** unique, corroborated, materially useful, source-cited, internally linked, explicit about uncertainty, and cleared by a quality gate.
4. **Economic proof:** independent buyer + settled payment + fulfillment + delivery evidence, joined through existing canonical economic observation modules.

Only class 3 belongs in the public observatory. Class 4 alone can advance the revenue scoreboard.

## Publication quality gate

Before publishing a public page, require all of the following:

- Primary source opened and materially corroborated, not just a search-result headline.
- No duplicate title, canonical URL, or substantially identical analysis.
- A page-specific answer or utility that is useful without clicking a commercial CTA.
- Source dates, data provenance, limitations, and clear UNVERIFIED labels where appropriate.
- Commercial CTA must be relevant to the observed problem and reference a verified existing offer; no default checkout or invented price.
- Correct route, title/description, canonical URL, working internal links, mobile layout, and no empty/loading/NaN output.
- The public index changes only after the page passes the same gate.
- A failed or empty source produces an internal diagnostic artifact, not filler.

Do not use a universal word-count target as a proxy for quality. Depth should follow the evidence and the question; do not pad pages to reach 600–1,200 words.

## Agent Bridge task handoff

Each bounded job should carry: `task_id`, objective, owner/node, status, target paths, base commit SHA, branch/commit SHA, source artifacts and hashes, output artifact and hash, tests/results, truth label, blocker, next owner, and timestamp. Claim before editing. One active writer per target path. Reject stale-base handoffs and require enforced lease/fencing at the write boundary. A signed receipt authenticates a claim; it does not prove the claim is true.

## Portfolio lanes and priority

**P0: First external revenue.** Ground candidate in a real source and existing offer, test the full authorized checkout-to-settlement-to-fulfillment path, and remove fabricated deterministic fallbacks. PR #546 tracks the current Quote Compare fallback defect.

**P1: Agent Bridge monetization.** Package a narrow authenticated A2A unit using existing commerce/receipt rails. Measure external developer demand before adding broad marketplace complexity.

**P2: Marketplace core.** Reuse the existing MTG canonical lifecycle (asset/listing → offer → distribution → buyer → settlement → fulfillment → evidence). Treat Music & Media, vinyl/auctions, FightEdge, templates, boilerplate, stencils, word banks, and neural-network assets as ordinary silos.

**P3: Trust and storefront integrity.** Correct NaN pricing, empty/loading states, unsupported inventory claims, and missing About/Trust routes. Publish only true, supportable statements.

**P4: Observatory compounding.** Build source-bound, non-duplicate pages in cohorts; measure indexing and click-through only when actual Search Console evidence exists. Do not promise rankings or an inflection date.

**P5: GPU marketplace.** First measure actual device capacity, idle windows, and unit costs. Any third-party workload requires isolation, quotas, model allowlists, no host/secrets access, abuse controls, metering, and a kill switch. No unrestricted remote code execution.

## Acceptance tests

- Model endpoints unavailable: candidate is explicitly unqualified; Gauntlet rejects it; no fabricated offer/price/buyer is emitted.
- Source unavailable: state is SOURCE_UNAVAILABLE, not zero demand.
- Duplicate source: no duplicate public page is created.
- Uncorroborated source: internal artifact only.
- Irrelevant CTA: publication fails.
- Candidate lacks existing-offer identity: cannot enter checkout.
- Workflow passes but no artifact is produced: compounding gate fails.
- Artifact is produced but not publicly published: receipt distinguishes internal from public.
- Revenue fields are absent or contradictory: revenue remains unverified.
- Stale Agent Bridge lease: write is rejected at the actual write boundary.
- Tampered artifact: signature/hash verification fails.
- Third-party GPU job without tenant isolation or quota: rejected.

## Current execution note

The 777 workflow file on the default branch already has staggered schedule, `workflow_dispatch`, and push triggers. This does not prove a new run occurred in this session. The run ID supplied in conversation could not be retrieved through the connected workflow-jobs endpoint; it remains unverified here. PR #546 is open and targets the deterministic Quote Compare fallback. Do not treat the engine as economically grounded until its test and runtime evidence are retrievable.

## Next bounded handoff

Use GitHub issue #549 as the portfolio queue. First verify the latest retrievable 777 run and PR #546 checks; then test/fix the fallback boundary, and make the next public page contingent on corroborated source quality. Persist the run receipt and its hashes to GitHub, Notion, and Airtable. Continue with the highest-leverage unfinished task rather than starting a competing architecture.
