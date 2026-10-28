# BECK independent Substack RSS research ingester

This is a **separate research input**, not a DreamMeez, marketplace or payment component. Code adapted from the user's supplied `core.py`, `bundle.py`, `importer.py`, `trends.py`, CLI, tests, systemd units, Dockerfile and configuration.

**Owner requirement:** no ChatGPT runtime dependency. Python 3.12+, `defusedxml` only for the cloud reader; summarization/inference happens locally after verified offline import.

## Boundaries
- VPS: public HTTPS RSS only, no cookies, LLM, buyer identity, Stripe secrets, or auto-publication.
- Sync: `outbox` from VPS to home PC via Syncthing or manual `scp`. Keep it separate from the managed KB. SHA-256 is corruption detection, **not authenticity**.
- Home PC: `python -m substack_ingest verify <bundle>` then `python -m substack_ingest import <bundle> --kb <private_kb>`. Verified imports are still `untrusted: true`, `agent_tool_authority: none`.
- BECK bridge: `python -m substack_ingest beck-export --kb <private_kb> --out <private_kb>/beck-evidence.json`. Only counts, hashes and trust labels. Neither the bridge nor original RSS has permission to make financial decisions, edit approved memory or activate SKUs.
- Air-gapped PC: transfer by USB and verify on arrival. Not an automated network hop.

## First live verification
`python -m substack_ingest probe --url https://www.oneusefulthing.org/feed --out live-probe.json`
A GitHub Actions job runs this exactly once when this component is changed or manually dispatched. It checks actual item-count parity and temporary bundle verification without persisting posts in GitHub artifacts. Do not claim the feed is live-compatible until its run exits PASS.

## What is not connected yet
VPS/Syncthing provisioning, user-selected watchlist, actual local ingestion task, signed manifests, cryptographic producer identity, DB-owned reconciliation across machines, and downstream publishing or commerce. No live ingestion service runs merely because source is merged.
