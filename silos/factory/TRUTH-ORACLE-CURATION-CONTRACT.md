# Truth Oracle Curation and Evidence Submission Contract

Status: INTERNAL DESIGN ONLY; NOT A DEPLOYED ACCESS-CONTROL CHANGE
Date: 2026-10-19

## Purpose
Truth Oracle is a curated, source-linked economic encyclopedia. The public may submit evidence, corrections, counterexamples, and replication attempts. Public submissions never directly edit canonical entries and are not automatically published.

## Flow
1. Elohim prepares or refines a candidate from named sources, existing artifacts, and explicit uncertainty labels.
2. CUBE discovers alternatives, counterexamples, and use cases. It does not publish.
3. Gauntlet challenges provenance, claim scope, freshness, contradictions, reproducibility, licensing, and deceptive incentives.
4. 777 returns evidence, qualified economic leads, audit components, reusable mechanisms, or a no-op/negative result through this same intake path. It may not bypass Elohim.
5. Public submissions enter a separate untrusted queue.
6. The human owner reviews evidence and the assistant's recommendation. Explicit approval is required before canonical publication.
7. Corrections create a new version linked to prior versions. Preserve the reason and provenance. Entries may be marked disputed, stale, superseded, or withdrawn from current recommendation without erasing history.
8. BECK records internal actions and economic events; it does not substitute for independent evidence.

## Submission fields
- Submission ID and received timestamp
- Target entry or claim, if applicable
- Source URL or artifact reference
- Exact claim supported or contradicted
- Source date and relevant passage/data location
- Evidence type and limitations
- Conflicts of interest and reproduction instructions
- Privacy/licensing status and permission to retain or publish
- Review status and reviewer decision

Do not collect unnecessary personal data. Never accept secrets, payment credentials, or private customer data into a public submission form.

## Canonical entry requirements
Stable ID and version; bounded claim; source references and dates; separate facts, estimates, assumptions, and unknowns; confidence and contradiction notes; reproduction steps and tests; review history; licence notes; and links to related hypotheses and observed outcomes.

## Statuses
SUBMITTED -> TRIAGE -> ELOHIM_REVIEW -> GAUNTLET_REVIEW -> HUMAN_APPROVAL -> PUBLISHED_VERSION

Alternative states: NEEDS_MORE_EVIDENCE, DISPUTED, REJECTED, DUPLICATE, QUARANTINED, SUPERSEDED.

A Gauntlet pass only makes a candidate eligible for human review. A public submission is not verified evidence merely because it was received. A published knowledge entry is not automatically a commercial outcome.

## Integrity and security
- Separate public write permissions from canonical publication permissions. Hiding edit controls is not access control.
- Validate and size-limit uploads; sandbox untrusted files and URLs.
- Use least-privilege server-side authorization.
- Preserve hashes and timestamps where useful, but do not claim a hash proves source truth or authorship by itself.
- Audit canonical changes and approvals.
- Keep internal notes, private customer data, credentials, and non-public commercial evidence out of public artifacts.
- Provide a correction/dispute path without allowing anonymous users to overwrite canonical history.

## Monetization boundary
Potential paid products include reviewed decision briefs, versioned evidence packs, structured exports, provenance APIs, and workflow integrations. These remain hypotheses until demand, source rights, delivery costs, and willingness to pay are demonstrated.

## Non-claim
This contract does not prove production permissions, RLS policies, moderation, versioning, or publication controls currently implement it. Those require implementation, tests, least-privilege checks, and read-after-write verification.
