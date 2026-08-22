# ANZ AI Agentic Commerce Wedge

Date: 2026-08-23
Status: EXECUTION

## Thesis

New Zealand does not need to build a frontier model to capture value from AI. The NZ Government's AI strategy explicitly prioritises adoption and application over competing with large foundational-model developers. That creates an opening for local implementation, control, evidence, and commerce infrastructure.

## Evidence

1. MBIE's 2025 SME research found 94% of New Zealand SMEs were aware of at least one AI tool, while adoption and confidence varied and concerns included accuracy, privacy, security, and trust.
2. MBIE's 2026 digital capability research reports that around half of NZ businesses are using AI tools and that 56% of businesses using digital tools externally say those tools help generate some current revenue, turnover, or sales.
3. MBIE announced in May 2026 that its AI Advisory Pilot was expanded to support up to 150 businesses, with eligible businesses able to access co-funding of up to 50%, capped at NZ$15,000, through 31 January 2027.
4. Australia has a larger addressable market. ABS reported 2,729,648 actively trading Australian businesses at 30 June 2025. ABS also reported AI use by 12% of businesses in 2024-25, up from 1% in 2021-22.
5. Australia's Department of Industry reported that 41% of SMEs were adopting AI in June 2025, with services and retail among the highest-adopting sectors.
6. Current agentic-commerce research identifies authorization, evidence, and protocol security as material barriers. This aligns directly with a productised control-and-proof service rather than another generic chatbot.

## Product wedge

Start with a paid, fixed-scope control assessment for one AI-enabled financial or commercial workflow.

Entry product:
- NZ$3,500 introductory assessment
- one workflow
- five business days
- control-gap report
- authorization, evidence, cross-system state, auditability, and remediation priorities

Expansion products:
- NZ$7,500 implementation sprint
- NZ$15,000+ controlled commerce integration
- recurring monitoring and evidence services only where the customer explicitly requests them

The existing DreamLedger offer file already defines the NZ$3,500 Agentic Finance Control Assessment. This execution layer does not replace that offer; it makes the economic proof and fulfillment path operational.

## Closed loop

DISCOVERY -> OFFER -> PAYMENT -> VERIFIED SETTLEMENT -> FULFILLMENT WORK ITEM -> HUMAN DELIVERY EVIDENCE -> NEXT-OFFER CANDIDATE -> PAYMENT

The loop is intentionally not fully autonomous at the public-contact boundary. Public posting, unsolicited contact, and buyer messaging remain disabled.

## Revenue mathematics

The wedge does not require a huge market share.

10 assessments x NZ$3,500 = NZ$35,000
100 assessments x NZ$3,500 = NZ$350,000
286 assessments x NZ$3,500 = NZ$1,001,000

A mixed ladder reduces required volume. For example:

50 assessments x NZ$3,500 = NZ$175,000
50 implementation sprints x NZ$7,500 = NZ$375,000
30 controlled integrations x NZ$15,000 = NZ$450,000
Total = NZ$1,000,000

These are arithmetic scenarios, not forecasts.

## Engineering decision

Do not build a new autonomous marketplace first.

Use DreamLedger as the proof spine:
- Stripe live payment evidence is settlement authority.
- Airtable is the operational economic index.
- GitHub Actions is deterministic reconciliation/orchestration.
- GitHub Issues are fulfillment work items generated from verified payments.
- Proof artifacts are hashed and retained as workflow artifacts.
- Public posting remains disabled.

## Current execution addition

`.github/workflows/economic-loop.yml` closes the first operational loop:

payment -> reconciliation -> idempotent fulfillment issue -> human delivery evidence -> next monetization candidate

It cannot manufacture revenue. It cannot turn an unpaid Checkout Session into a payment. It cannot contact buyers publicly.

## Gate

The millionaire trajectory remains unproven until live paid transactions accumulate. The correct next proof is not more architecture. It is settlement evidence, fulfillment evidence, repeat purchase evidence, and increasing average revenue per customer.
