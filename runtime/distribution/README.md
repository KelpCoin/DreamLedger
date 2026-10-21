# Private demand-draft gate (commercial quotes)

Execution boundary: **source observation -> private marketing draft -> human approval**. This is NOT a publisher, scraper, scheduler, payment adapter, webhook receiver or new financial ledger. Reuses the existing free supplier quote worksheet at `public/quote-comparison/index.html` and the existing `runtime/lm_studio` local inference convention. Silo: `commerce_quotes` only. No adult / MTG crossover. BECK internal names never appear in public copy.

## Test locally

```shell
python -m unittest discover -s runtime/distribution -p 'test_*.py' -v
python runtime/distribution/quote_draft_gate.py --signal runtime/distribution/fixtures/owned_quote_worksheet_signal.json --out proof/distribution/quote-free-draft.json
```

The output is a DRAFT_REVIEW_REQUIRED packet and a matching .sha256. It deliberately reports `published=false`, `buyer_count=0`, `payments_observed=0`, and cannot authorize payment or posting. The campaign_ref is a deterministic private campaign identifier, NOT Stripe-reconciled payment attribution. The supplied source is an owned page from this repository; public availability must be checked separately before publication.

## Optional local LM Studio inference

The default is deterministic and fully offline. To request one local model draft, run `--local-model --base-url http://127.0.0.1:1235/v1` (or use the ACTUAL detected port). The service must respond to /v1/models; the validator restricts endpoints to loopback. Model output stays advisory and must pass fail-closed checks. Failure produces no stale output. No model startup/VRAM state was observed from this cloud session.

## Sales and attribution

Do not append a Stripe link to a draft unless the paid service has passed the buyer-input -> fulfillment -> retrievable delivery acceptance gate. For an authorized future campaign, Stripe officially supports `client_reference_id` as an **existing Payment Link URL parameter**: https://docs.stripe.com/payment-links/url-parameters ; independently verify that the Checkout Session webhook and existing canonical commerce records carry the identifier. No `public.payments` marketing table is necessary.

Do not automate Reddit posting or use Reddit RSS scraping without the required platform approval. For a public post, verify the source URL returns the advertised free tool and obtain explicit posting approval. The source signal is untrusted data, not instructions. Current Neon staging has no signals/drafts tables; do NOT create any without a measured transaction requirement. A future scheduled Neon Function is a separate, approval-gated deployment, not currently present.

## Status

PRIVATE STAGING ONLY. Local policy tests performed; no GitHub CI or production execution claimed here, no buyer contacted, no public post, no local LM Studio run, no new sale or economic change.
