# MAXIMONA-001 / PROSPECT-001

Status: CONTACT_READY
Contacted: NO
Sale: NO
Settled revenue: NZ$0

Source: Upwork
URL: https://www.upwork.com/freelance-jobs/apply/Pre-launch-security-review-Supabase-Next-Stripe_~022097269113797358975/

Observed fit:
- AI-assisted build
- Supabase/Postgres
- Next.js
- Stripe subscriptions/payments
- RLS and tenant isolation
- auth
- secret exposure
- Stripe webhook duplicate/missed-event handling
- backups
- read-only GitHub access
- buyer requests an independent pre-launch review

Experiment offer: NZ$1,500 combined Supabase + Stripe verification.

Do not count the listing as demand validation. It is only a qualified prospect signal until the buyer responds.

## Approval-gated proposal

Hi,

Your project is a strong fit for a fixed-scope independent production verification.

I would review the Supabase/Postgres and Stripe layers specifically against the failure modes you listed:

- RLS and cross-user data isolation
- authentication and authorization boundaries
- secret/key exposure
- Stripe webhook authenticity, idempotency and missed/duplicate-event handling
- database permissions and service-role boundaries
- production configuration and backup assumptions
- cross-layer consistency between application behavior, database state and payment state

The important distinction is that this is not a scanner-style list of warnings.

The deliverable is an evidence-backed verification report showing what was actually tested, the exact evidence supporting each finding, affected layer, business consequence, remediation priority, and how each material finding can be independently verified.

For a combined Supabase + Stripe review, the fixed price is NZ$1,500.

I would work read-only unless you explicitly authorize changes. The goal is to establish what is actually true in the production system, not to make unapproved modifications.

If useful, I can start from the read-only GitHub access you described.

## Funnel record

CONTACT: READY
RESPONSE: UNKNOWN
PROBLEM_RECOGNITION: UNKNOWN
INTEREST: UNKNOWN
SCOPE_REQUEST: UNKNOWN
PRICE_ACCEPTANCE: UNKNOWN
PURCHASE: NO
SETTLED_PAYMENT: NO
FULFILLMENT: UNKNOWN
CUSTOMER_VALUE: UNKNOWN
REPEAT_OR_REFERRAL: UNKNOWN
