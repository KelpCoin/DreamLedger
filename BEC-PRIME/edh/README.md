# EDH One-Link Pipeline

One saved public ManaBox deck URL becomes a normalized DreamLedger MTG deck package: deck manifest, bounded Monte Carlo comparison, primer, hero-media prompt, catalogue product record, and machine-readable proof.

## Usage

```text
node BEC-PRIME/edh/EDHOneLinkPipeline.js --url=https://manabox.app/decks/SHARE_ID --compare=EDH_0001,EDH_0002
```

Windows launcher:

```powershell
.\BEC-PRIME\scripts\Invoke-EDHOneLink.ps1 -Url 'https://manabox.app/decks/SHARE_ID' -CompareIds EDH_0001,EDH_0002
```

The comparison list is capped at five IDs. The source host is allowlisted and HTTPS is mandatory.

## Output

Each job is written under `BEC-PRIME/data/mtg/edh-jobs/<job_id>/`:

- `deck.json` normalized provenance + cards
- `benchmark.json` comparison evidence
- `primer.md` structured primer
- `hero-prompt.txt` media-generation input
- `PROOF.json` machine-readable proof

A catalogue record is written to `BEC-PRIME/catalog/products/<product_id>.json`.

The first slice deliberately stops short of pretending to have a rules-accurate Commander simulator. The benchmark is labelled `FIXTURE_BENCHMARK` and uses a deterministic heuristic Monte Carlo model. A future rules-accurate engine can replace the benchmark implementation without changing the product manifest contract.

## Publishing boundary

Generation is automated. Public sale activation remains approval-gated. The generated product carries `commercial_truth.approval_required=true` and therefore is not exposed by the normal checkoutable product loader until explicitly approved.

`--publish-approved` changes the pipeline state to `published` for an already-approved operator action, but it does not bypass the commerce truth loader.

## Media boundary

The pipeline creates a deterministic hero prompt immediately. ComfyUI/ChatUI image and video execution is an enhancement adapter and is intentionally not required for the first catalogue package. No generated asset is represented as official Magic artwork.
