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

## Trade-first product decision, 31 October 2026

The owner has explicitly decided NOT to build a general MTG forum, votes, karma, or generic deck-sharing network as an acquisition strategy. These duplicate incumbent advantages. The product wedge is a FREE New Zealand-first bilateral trade record that captures exact accepted card terms and self-reported dispatch/receipt. A public /mtg/trade/?id=<uuid> page is an opt-in, anonymous projection, only after BOTH traders authorize sharing. No name, account ID, contact, tracking number, notes, private photo hash, or delivery address is displayed. The endpoint returns 404 if the sharing requirement is not met. An agreed trade can be disputed later.

IMPORTANT: NZ genuine private sales generally fall outside FTA and CGA, but CCLA and contract-law remedies can still apply. Recording evidence does not mean no dispute or proven shipment. EchoMTG already offers haves/wants matching and shipping confirmation, so do not claim invention of trade logging. Our candidate differentiator is evidence quality and NZ-specific workflow, still unproven commercially.

## What is implemented versus still missing

- Code-stage: existing migration for terms and consent; additive migration for dispatch, receipt, mutual public opt-in/unpublish, dispute and anonymous public projection; signed-session action API; public GET API; static responsive receipt view; ephemeral PostgreSQL and Node tests.
- NOT DONE: migrations in even the actual Neon staging deployment, independent authenticated real two-user end-to-end trial, durable third-party anchoring, signed nonrepudiation, mail/notifications, seller matching, proven shipment, delivery evidence from carrier, rate limiting and independent review, reputation from genuinely completed trades, production deployment, customer records and turnover.
- Deployment must require current exact-head CI and owner approval. Server-side feature flag defaults OFF. The app DB role should have only audited EXECUTE access after ownership and privileges are separated. No table DML, PUBLIC function EXECUTE, or BYPASSRLS.
- A stored hash chain is tamper-evident relative to the preserved events, NOT immutable to the database administrator. Independently time-stamped daily heads, access controls, retention backups and third-party verification remain release requirements.
- Public permalink uses /mtg/trade/?id=UUID. The desired pretty /mtg/trade/UUID route is a separate Vercel rewrite decision requiring independently tested deployment routing. Never claim it exists already.
- Diagnostic is NZ$29, Patreon membership exemption only after verified eligibility. No free diagnostic CTA should be released from stale templates.

## Live Neon staging read-only verification, 2026-10-31 NZDT

Connected project: dreamledger-migration-staging (Neon project falling-base-50259456), default database neondb. Read-only SQL observed `marketplace.mtg_trade_agreements` ABSENT, connected `current_user=dreamledger_app`, and `pg_roles.rolbypassrls=true` for the current application role. This is a decisive release BLOCK. Do not migrate the ledger into this unsegregated owner/app role, grant app CREATE/DML, or claim permission-safe append-only evidence. Staging verification needs an independent migration/owner role, a NO BYPASSRLS runtime role, deliberate EXECUTE-only grants, read/write denial tests and an independent immutable anchor. No database mutations were made by this verification.
