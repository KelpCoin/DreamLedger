# 777 Repository Handoff Directory

Offline or local-GPU workers may place one `dreamledger.777.repository-lead.v1` JSON packet here. A lead must contain:
- a safe `expedition_id`, timezone-aware `found_at`, and worker/runtime identity;
- one public GitHub repository owner/name and canonical URL;
- a concrete capability gap, why it matters, and evidence that existing DreamLedger substrate was inspected first;
- a reuse recommendation and SHA-256 of the canonical JSON excluding `packet_sha256`;
- all safety controls set to false for private data transfer, credential transfer, code execution, dependency installation, production change, external action, and revenue claim.

The online membrane checks the live public GitHub API for repository visibility, default branch, current head SHA and licence evidence. It emits an `ONLINE_VALIDATED` packet under `data/777/repository-expeditions/` and a reviewable workflow artifact. It never downloads or executes candidate source code. A missing, private, stale, tampered, or unlicensed lead is quarantined. Licence uncertainty forces reference-only review, not installation.

Do not commit private prompts, secrets, local file paths containing usernames, buyer data, or code bundles to this directory.
