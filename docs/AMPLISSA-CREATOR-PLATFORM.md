# AMPLISSA.com: Creator Platform MVP

> **Silo boundary:** AMPLISSA is an independent adult-content SPV under the Elohim → Brown Eye Cortex Krinkle (BECK) hierarchy. DreamLedger is a separate SPV, not AMPLISSA's parent. See [BECK ecosystem hierarchy](BECK-ECOSYSTEM-HIERARCHY.md). Shared orchestration does not permit shared creator data, media storage, service-role credentials, or implicit commerce access.

## Product objective

Build AMPLISSA as a creator-first platform for BBW/SSBBW creators, beginning with the founder's wife as the first creator. The product should let creators publish and manage their own content with clear ownership, privacy, audience, and payout controls. Build for a global audience by default; apply local legal requirements where relevant.

This document is a product contract, not a claim that a live website or payment path already exists.

## MVP sequence

1. **Public discovery shell:** branded landing page, creator profiles, category/tag browsing, content previews controlled by creator visibility settings, clear community rules, and accessible mobile-first layouts.
2. **Creator studio:** authenticated upload, draft/publish/unpublish, captions, tags, content status, upload progress, retry, and creator-owned deletion/export.
3. **Media pipeline:** private object storage by default, MIME/type and size validation, malware scanning where available, generated thumbnails, transcoding jobs, immutable asset IDs, and signed/time-limited delivery URLs. Never put private media in the public Git repository.
4. **Audience and access:** public preview versus paid/member-only content, age gate where lawful content requires it, account recovery, blocked users, and privacy-safe analytics.
5. **Commerce:** integrate only a payment provider whose written terms permit the exact intended content category and geography. Reconcile signed webhooks, settled payment, entitlement, access enforcement, refunds/chargebacks, and fulfillment. Do not enable paid access until an end-to-end test proves the entire chain.
6. **Creator trust and safety:** creator identity/age verification before adult-content publishing, documented consent and rights for every depicted person, prohibition on minors and non-consensual intimate imagery, reporting, rapid takedown, appeals, repeat-infringer controls, and a documented law-enforcement/legal request process.
7. **Creator economics:** transparent fees, payout status, tax records where required, chargeback handling, account export, and no claim that a pending payment is earned revenue.

## Non-negotiable safety and privacy controls

- All creators and depicted persons in adult content must be adults; verify age and identity through a suitable specialist provider before enabling adult publishing.
- Obtain documented consent and distribution rights for every depicted person and asset. No hidden-camera, coerced, stolen, deepfake sexual imagery, or non-consensual intimate content.
- Use an independent payment-provider eligibility check before choosing a processor. Do not assume Stripe or another provider permits adult content; do not disguise the business category or route around provider policy.
- Private media remains private unless a creator explicitly publishes it. Enforce authorization server-side on every asset fetch, not merely by hiding UI controls.
- Do not expose creator legal names, identity documents, private addresses, or payment details in public pages, logs, URLs, analytics, or generated AI context.
- Provide deletion, export, content-reporting, and takedown workflows. Retain only records required for safety, disputes, or law.
- Keep all uploads and moderation decisions attributable, timestamped, and auditable. AI may prioritize review but cannot be the sole authority for identity, consent, takedowns, or appeals.
- Meet applicable privacy, consumer, age-verification, tax, and online-content laws in each operating market before accepting users there.

## Initial architecture

- **Web:** mobile-first creator site with server-side authorization and accessible controls.
- **Identity:** managed authentication; separate public creator handle from verified legal identity.
- **Database:** a dedicated AMPLISSA database/project or formally isolated database boundary with its own least-privilege roles, RLS policies, backups, and migrations. Do not reuse DreamLedger service-role credentials or creator records. AMPLISSA's commercial truth stays vehicle-specific; BECK may aggregate evidence references, not merge private data.
- **Media:** private object storage with signed delivery; database rows alone do not prove an upload or delivery.
- **Jobs:** durable, idempotent queue for scanning, transcoding, thumbnails, and delivery receipts.
- **Payments:** provider adapter behind a compliance-checked boundary; webhook signature verification and idempotency; settled payment is required before granting paid entitlements.
- **Evidence:** link upload hash, moderation state, creator authorization, entitlement decision, delivery receipt, refund state, and external settlement reference. Keep test/simulated records out of economic totals.
- **Operations:** health checks, alerting with secrets redacted, restore drills, abuse-response runbook, and audit logs.

## Acceptance gates

### Gate A: safe upload
- Authenticated creator can upload an allowed test asset.
- Upload size/type rules are enforced server-side.
- Stored object is private until published.
- Hash, size, owner, and processing status are recorded.
- Unauthorized users cannot fetch private assets.
- Creator can unpublish and delete their own asset.

### Gate B: creator safety
- Publishing is blocked until required age/identity, consent, and rights checks are satisfied.
- Report/takedown flow is usable on mobile.
- A takedown blocks delivery, including previously issued URLs after their short expiry.
- Audit trail contains no raw identity documents or secret values.

### Gate C: paid access
- Written provider approval/eligibility is documented for the intended business and content category.
- Test-mode end-to-end flow proves signed webhook -> settled payment state -> entitlement -> server-side access -> delivery receipt.
- Duplicate and out-of-order webhook tests pass.
- Refund/chargeback revokes or adjusts access according to published policy.
- Live checkout remains disabled until separately authorized and tested.

### Gate D: production release
- Backup and restore verified.
- RLS and storage access policies tested with positive and negative cases.
- Rate limits, abuse controls, privacy policy, terms, creator agreement, refund policy, and takedown policy are published.
- Accessibility and mobile smoke tests pass.
- Rollback is documented and rehearsed.

## Build order

1. Establish domain/repository/deployment ownership and inspect the current public site.
2. Build a static preview and creator-studio UX using synthetic content only.
3. Add authentication and private upload storage.
4. Add rights/consent and moderation states.
5. Complete security and recovery tests.
6. Select a compliant payment provider and prove test-mode entitlement delivery.
7. Only then request authorization for live payment activation.

## Explicit non-goals for MVP

- No open, unmoderated public uploads.
- No automatic publishing of AI-generated or user-uploaded adult content.
- No scraped creator content or unauthorized imports.
- No token/crypto payment rail as a shortcut around processor eligibility.
- No public deployment, live checkout, creator payouts, or irreversible account actions without explicit authorization.
