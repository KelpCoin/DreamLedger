# DreamLedger MTG Community and Bilateral Trade Ledger: release evidence

## Benchmarks, 31 October 2026

Reddit r/mtg has user-created discussions, comments, vote-ranked feeds, flairs and active community moderation. MTG Salvation maintains long-lived and deep format-specific conversations including rules, Commander, custom cards, speculation and deckbuilding. The staged MTG Exchange is a visual front door with a local binder, not a competing discussion network. The existing CUBE v2 community API on the same branch is moderated, read-only, draft and not yet an operational discussion site.

## Reusable stack, no reinvention

This change is based directly on existing Neon marketplace and signed-session code in draft PR #887. It registers a single feature-gated MTG API in the existing Vercel route dispatcher, adds one migration and one focused test suite. The MTG Exchange visual implementation is separately staged in PR #909. No new public release, charge, email, platform fee or cross-silo data sharing.

## What the ledger does and does not prove

A proposal freezes the exact printing, set, collector number, condition, quantities, photo SHA-256 refs, cards given by each side, any NZD cash difference and shipping/pickup terms. A signed-in participant can explicitly acknowledge the existing terms SHA-256. Both acknowledgments cause an AGREED state, preserving earlier proposal and consent events. Declines, cancellations and disputes remain observable as new events. SQL row locks serialize changes, event IDs use deduplication keys, and a hash chain connects the history.

This is not yet externally immutable. A privileged database operator can rewrite data, the application session can be compromised, and an endpoint can be misconfigured. Require independent hash anchoring, separated privileged roles, tested backups and independent audit proofs before using stronger language. The ledger must never promise that either party is legally barred from contesting a trade: fraud, forgery, mistake, misdescription, non-delivery and statutory rights can remain relevant. Events show a stated agreement, NOT delivery, authenticity, completed payment, ownership or legal enforceability.

## Necessary production gates

1. Branch/PR exists and latest exact-head CI passes both Node tests and a real migrated PostgreSQL two-party concurrency test. Node mocks alone cannot prove SQL correctness.
2. The migration is applied only in a controlled STAGING database first. Production migration, credentials and feature flag require explicit owner approval.
3. Security-definer function owner is independent from the application role; no BYPASSRLS or table DML rights are granted to application principals. Authentication must be independently validated before any callable SQL function trusts an actor ID. Restrict grant path and log suspicious attempts.
4. Rate limiting, spam controls, report abuse, trade freeze, signed consent audit and signed-session token revocation must be validated. No sensitive customer details in public records.
5. A second, truly independent participant successfully proposes and accepts the exact terms in staging; a third cannot read them; replay and mutation attacks fail.
6. Independent day-level hash roots and retention/restore validation are necessary to support a durable tamper-evident promise.
7. Add actual seller listing and stock evidence, trade matching, completion/receipt of goods, notifications, disputes and reputation before claiming a completed marketplace.
8. Create real moderated posts, threaded replies, user roles, curated NZ local events, searchable deck primers and content reporting before claiming parity with Reddit/MTG Salvation.
9. Commander Diagnostic is NZ$29 with eligibility-based Happy Homarid Patreon exemption, not a permanent free public report. Patreon OAuth and member tier access must be validated server-side, never from a browser field. No live entitlement, member or checkout flow is proven here.
10. Github Actions schedule alone cannot be treated as a reliable calendar. Use existing authorized external heartbeat if available, an idempotent durable job inbox and a delayed/missing-execution alarm. Name the specific external scheduler before declaring autonomy.
11. All cloud state is canonical; a local PC is an optional accelerator. Do not migrate the business's proof of truth into a Windows-only directory.
12. No live payments, stock decrement, seller payout, deployment or public social post without explicit approval.

## Short verification

Run `node --test handlers/cube/mtg-trades.test.js`. The private review workflow emits `artifacts/mtg-trade-ledger-proof.json` keyed by exact commit SHA. This evidence is CODE_PROOF, not a two-party trade receipt, payment or legal certification.
