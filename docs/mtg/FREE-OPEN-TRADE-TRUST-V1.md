# MTG Master: Free Open Trading and Earned Reputation

Status: **DRAFT / NOT DEPLOYED**. Owner-directed design, 2026-11-01.
This document is a contract for a no-fee, low-friction NZ trading-card marketplace.
No public sale, solicitation, payment, deployment or identity verification is
authorised by this file.

## Five non-negotiable user experiences

1. Browse public card and deck listings without registration, fees or posting a forum thread.
2. Import a listing by pasting text/JSON or adding a user-supplied link, without scraping another provider or falsely claiming their reputation.
3. Publish a **guest listing** with a self-selected avatar/handle, public HTTPS contact link, NZ private/in-trade status and private single-use owner removal token. A forum post or account is not required. Only high-confidence spam/abuse and bounded rate controls apply.
4. Open an optional private **two-person trading passport**, negotiate directly, confirm terms and card delivery, and exchange independent feedback. The passport charges NZ$0, never holds funds, and never needs government names.
5. Earn public verified reputation only after independent evidence of a real completed sale **or** physical card-for-card trade. Self-authored references, two anonymous bearer tokens, money paid to DreamLedger or a purchase of a badge do not add reputation points.

## Three separate levels of trust

- **Handle/avatar**: pseudonymous, free and not identity-verified.
- **Peer-attested trade**: the initiator and an invited participant claim they agreed and completed an exchange. A receipt hash is a continuity marker, not independent confirmation; neither participant is necessarily an independently distinct human.
- **Independently verified transaction**: distinct independently checked counterparties, completed exchange and delivery proof. Paid sales also need provider-reconciled settlement. This is eligible for a conservative reputation score.

Display new users as **No verified history yet**, never 0 stars. Verified history uses a Wilson 95% lower confidence bound with a limit of one reputation-contributing outcome per independently identified counterparty and the actual positive/negative outcome counts; rating can never be purchased. Neutral reviews remain visible in future feedback UX but are not included in the current numeric function until an explicit scoring policy exists. Self-submitted external posts may be shown as **linked, unverified history**, never as verified sales. Imported handles require a separate ownership challenge before any future verified-ownership badge.

## Free, private trade ledger

The existing MTG API gains an opt-in passport route under
`/api/mtg/marketplace/trade/{create,join,view,agree,complete,feedback}`.
All actions are explicit and use unguessable private bearer capabilities. An
invitation link may use a URL fragment so the code is not sent in the HTTP
query string. Hashes of capabilities are stored, never the raw tokens.

The append-only sequence of event hashes detects accidental changes when
compared against a trusted earlier digest; **it is not an immutable ledger,
cryptographic identity signature, escrow or independent economic receipt**.
It still needs production transaction isolation, durable backup and
independent proof reconciliation before live certification.

Current `mtgTradePassport` returns zero verified sale/reputation credit even
when both peers confirm completion. The reputation adapter can separately
credit an **independently reconciled** unpaid card-for-card swap.

## Moderation, appeals and abuse

Gauntlet rejects embedded markup, holds direct threats and suspicious link
spam, and rate-limits automated listing submissions. This is a limited
deterministic baseline, **not a complete hateful-content classifier**.
Human appeal and override must be added before offering a production
moderation service. Never allow paid promotion to bypass moderation.
A user's freedom to trade is not an entitlement to impersonate others,
threaten people, expose private data or defraud traders.

Private receipt notes or public feedback containing sensitive contact details
should not become globally searchable. Avoid hidden scores, arbitrary
paid tiers, proof laundering, reciprocal feedback rings, and unverifiable
claims of identity. No identity badge is issued without actual proof.

## NZ legal and privacy boundary (primary guidance)

- New Zealand Commerce Commission: a seller *in trade* must clearly disclose
  that status. The marketplace must take reasonable steps to facilitate the
  disclosure. https://www.comcom.govt.nz/business/your-obligations-as-a-business/what-is-being-in-trade/
- Office of the Privacy Commissioner, Principle 1: collect identifiers only
  when necessary for a lawful purpose.
  https://www.privacy.org.nz/privacy-principles/1/
- Office of the Privacy Commissioner, Principle 3: clearly explain why
  personal information is collected and to whom it may be disclosed.
  https://www.privacy.org.nz/privacy-principles/3/
- eBay's feedback manipulation policy explicitly forbids buying/selling
  feedback and coordinated reputation inflation.
  https://www.ebay.com/help/policies/feedback-policies/feedback-manipulation-policy?id=4231

There is no blanket requirement to publicly display a government name to
browse, publish a non-regulated listing or trade cards. Formal identity
verification, if offered, must be voluntary unless an independently
identified law, fraud risk or regulated payment flow requires otherwise.
Any necessary identity data must be held off the public profile in a
purpose-limited access-controlled store; **do not put passport scans,
licence details or civil names in public URLs, feedback or hash logs**.

## Production gates still open

- Existing registered marketplace route persists some MTG records in a
  legacy data root also used by another subsystem. New private passports
  use an isolated MTG directory, but comprehensive migration/silo isolation
  still requires a verified plan.
- Guest listing contact links are self-declared and do not prove ownership.
- The invite secret may be controlled by the initiator: peer acknowledgements
  cannot be counted as independent transactions.
- API persistence is file-based. Cross-instance locking, backup, retention
  policies, authentication hardening, secure log review and availability need
  production tests before merge or deployment.
- No moderation appeals UI or independent external profile ownership proofs
  are yet implemented.
- No verification that actual live dreamledger.org/mtg-marketplace/
  serves the new code, and no end-to-end independent trade completed.

## Tests and rollback

```sh
node --test BEC-PRIME/lib/mtgTradePassport.test.js BEC-PRIME/lib/mtgReputation.test.js BEC-PRIME/lib/mtgMarketplaceGauntlet.test.js BEC-PRIME/routes/mtgMarketplace.passport.test.js public/assets/mtg-reference-import.test.js
node --check BEC-PRIME/routes/mtgMarketplace.js
node --check public/assets/mtg-trade-passport-client.js
```

This remains a draft PR. **Close without merging** to roll back entirely.
No finance, checkout, live payment link, public posting or domain settings
have been changed.
