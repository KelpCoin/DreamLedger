# DreamLedger venture test layer

Status: **design scaffold only, not a published or validated venture**.

Use one domain and distinct paths: `/ventures/<slug>/`. A path is eligible for public launch only when it describes a distinct buyer, costly problem, offer, evidence, fulfilment, and commitment. Do not clone pages with swapped nouns or create location doorway pages.

## Existing substrate

- The canonical site already has quote-comparison pages, Truth Oracle, an agentic-commerce readiness/checklist surface, and the NZ$149 Agentic Commerce Remediation Blueprint.
- The blueprint is the strongest near-term test candidate because it already has a bounded offer and existing checkout route. Improve discovery of that offer before inventing a second product.
- No existing page view, QR scan, model score, checkout creation, payment attempt, or internal database row is a verified sale.

## Six-block launch checklist

1. **Hero:** task, concrete before/after, named buyer, one truthful proof element.
2. **Problem:** specific language grounded in a real demand signal; unknown claims remain unknown.
3. **Offer:** exact scope, price/currency, delivery timing, exclusions, refund/fulfilment terms.
4. **Evidence:** source-linked sample or clearly labelled demonstration, never fabricated testimonials or results.
5. **Commitment:** prefer the existing fully described purchase where fulfilment is ready. Never take a deposit for an unready offer without clear terms, refund handling, and a credible delivery plan.
6. **Legal:** verified legal seller/entity, NZBN when applicable, contact details, privacy and terms. Do not publish placeholders or invent an NZBN.

## Tracking contract

The minimal funnel is `venture_page_view`, `commitment_initiated`, `commitment_completed`, each carrying a stable `venture_slug` and currency/amount where appropriate. Record a completed commitment only from a trusted payment-provider confirmation/webhook, deduplicated by event ID. Keep analytics identifiers pseudonymous; never send medical, legal, invoice, quote, or other sensitive payloads to analytics. A click on Buy is not a completed commitment. A payment must still be reconciled to a buyer and fulfilled order before being counted as verified revenue.

PostHog is **not configured by this scaffold**. Do not add a fake project key or emit browser events that imply payment settlement. Wire analytics only after the project and privacy settings are confirmed.

## Hypothesis scoring

Use `runtime/lm_studio/venture_hypothesis.py` and `venture_hypotheses.example.json`.

- Four Problem Core H-scores must each be at least 7.
- The six scale levers are weighted to 100 points.
- Below 60: kill; 60–74: iterate; 75+: eligible for the test layer only when the Problem Core passes.
- H-score means venture potential *if the assumption were true*. E-score means actual evidence. High H + low E means design a test, not claim validation.
- Missing scores hold. The tool cannot promote an unverified hypothesis into a buyer or revenue outcome.
- The example scores are provisional hypotheses, not research findings or independently validated scores. Replace them only with source-linked evidence and a recorded reviewer.

## Capacity and governance

- At most five concurrent test pages and two or three promoted brands.
- Archive rejected hypotheses with reason and evidence refs.
- No automated external outreach, ad spend, deposits, public publication, or formal commitments from the scoring tool.
- Promote only after a genuine external commitment and verified delivery path. Record refunds, chargebacks, and failed fulfilment as first-class outcomes.
