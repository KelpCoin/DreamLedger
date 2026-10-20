# 777 Repository Expedition Contract

A repository lead found by a cloud or local GPU worker can cross the offline/online membrane as a small JSON packet. The returned artifact records a discovery and a reviewable reuse hypothesis; it never grants permission to install code or take external action.

## Route

1. A worker emits a lead packet containing only public repository identifiers, the specific capability gap, and the reason it might help. Do not export credentials, private files, customer data, local prompts containing secrets, or executable bundles.
2. The online membrane independently refreshes public GitHub metadata, current default-branch HEAD, visibility, and licence evidence. A packet with stale or missing verification is quarantined, not admitted as online-validated.
3. An admitted packet is saved as `data/777/repository-expeditions/<expedition_id>.json`, with SHA-256 over canonical JSON excluding the `packet_sha256` field. The worker/runtime identity, origin, checked timestamps, and evidence URLs travel with it.
4. 777's compounding gate validates the packet and records it separately from website artifacts. The economic truth state stays `UNVERIFIED`; a new repo lead is not revenue and is not an integration.
5. Human/release authority and Gauntlet review remain necessary before code import, installation, merge, deployment, or production use. The promotion from candidate to PROVEN requires licence/security review, version pinning, tests, rollback, and a measured improvement on a subsequent comparable run.

## Required content

Use schema `dreamledger.777.repository-expedition.v1`. The packet must identify the public repo and default-branch SHA, cite metadata and licence evidence URLs, name the concrete gap and existing-stack check, describe maintenance/security/compatibility/cost, recommend one of `REFERENCE_ONLY`, `DEPENDENCY_CANDIDATE`, `CODE_IMPORT_CANDIDATE`, or `REJECTED`, and include fail-closed controls. Unknown licence means reference-only or rejected, never code-import candidate.

The validator accepts only `ONLINE_VALIDATED` packets with public metadata and a timestamped evidence trail. Offline observations alone remain a lead, not an admitted compounding artifact.
