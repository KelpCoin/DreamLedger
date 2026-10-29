# Draft legal hardening: NZ Terms and explicit acceptance
Status: PRIVATE REVIEW / DRAFT PR. Not deployed, not legal advice. Counsel approval required before public terms take effect.

## Verified baseline
Original `public/terms.html` dated 11 October 2026 contained no NZ$25,000 per-asset penalty, no NZ$1,000/day fee, and no claim that a SHA-256 hash is conclusive evidence. The canonical signup `BEC-PRIME/routes/auth.js` previously had no versioned acceptance gate. Actual Node runtime serves `BEC-PRIME/compiled/website/`.

## Changes in this branch
- New runtime `terms.html` and `privacy.html` for the links used by the signup forms.
- Baseline Terms now expressly distinguish lawful use from proven infringing acts; no automatic penalties; recovery only to extent allowed by law and evidence.
- Hash wording is limited to integrity and recorded-event evidence, not proof of authorship, ownership or first creation.
- `lib/termsAcceptance.js` computes SHA-256 of current server-side Terms and validates the checkbox + version + digest sent by signup.
- `routes/auth.js` exposes GET `/api/account/terms-version`, rejects registration absent matching current acceptance (HTTP 428), and records accepted digest/version/UTC time into the user's existing account record.
- Compiled and public registration pages require an unchecked Terms checkbox. No separate marketing consent is implied.
- Focused tests and CI verify version mismatch fails, runtime/source parity, and route/frontend integration.

## Legal caveats
Do not assume renaming a punitive term an indemnity makes it enforceable. NZ Supreme Court `127 Hobson Street Ltd v Honey Bees Preschool Ltd [2020] NZSC 53` requires examination of legitimate interests/proportionality. The Evidence Act 2006 s137 presumption is rebuttable and not a copyright priority determination. NZ Copyright Act 1994 sections 80A-80D may protect specified lawful software activities. The Fair Trading Act unfair-contract-terms regime is material for standard form consumer and qualifying small-trade contracts.

## Further review before merge
1. NZ-qualified lawyer approves final wording, effective date and notice under relevant consumer/trade law.
2. Verify every production registration entrypoint uses the gated handler and no alternate signup route bypasses it.
3. Browser integration and usability tests for keyboard/screen readers, privacy and Terms links and version drift.
4. Do not claim retroactive acceptance for existing accounts. Consider requiring versioned acceptance on the next account-affecting transaction if legally needed.
5. Use independent timestamping only if its evidence mechanism and provenance have actually been verified. Do not invent Bitcoin anchoring receipts.
6. Check data retention and deletion workflow for acceptance logs under the applicable privacy notice.

## Sources
- https://www.courtsofnz.govt.nz/cases/127-hobson-street-limited-v-honey-bees-preschool-limited-1-1
- https://www.legislation.govt.nz/act/public/2006/69/en/latest/sections/DLM393979/
- https://www.legislation.govt.nz/act/public/1994/143/en/latest/
- https://www.comcom.govt.nz/consumers/your-rights-as-a-consumer/unfair-contract-terms/
- https://www.comcom.govt.nz/business/your-rights-as-a-business/unfair-contract-terms/

No public release or contractual effect is claimed from this draft.
