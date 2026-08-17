# CUBE Target Shortlist v1 — Cross-System Agentic Finance

STATUS: PROPOSED
TYPE: COMMERCIAL TARGET DISCOVERY
ENGINEERING: FROZEN
CUBE REVENUE: NZ$0

---

## Objective

Identify 10 real enterprise candidates where autonomous systems already
hand off consequential financial state across platform boundaries, and
where independent execution assurance may be missing.

These are research hypotheses, not validated customers.

---

## Scoring Model

Each target scored 1-5 on:

- EVIDENCE = public evidence of agentic financial handoff
- CONSEQUENCE = damage if handoff is wrong
- AUTONOMY = human intervention level
- GAP = independent proof gap
- OWNER = identifiable risk/budget owner
- CUBE FIT = maps to CLAIM -> EVIDENCE -> AUTHORITY -> POLICY -> STATE -> VERDICT -> PROOF

---

## Target List

### 1. SAP Joule Autonomous AP / Vendor Payments

WORKFLOW:
Agent creates supplier payment, manages automatic payments, posts outgoing payment.

WHY INTERESTING:
SAP publicly describes autonomous spend management across procurement, travel,
expenses and finance.

CUBE QUESTION:
Can the organisation independently prove that each SAP-agent payment satisfied
invoice, vendor, approval, three-way match, duplicate check and policy conditions?

OWNER HYPOTHESIS:
Financial Controller / SAP Finance Systems Owner

SCORE:
EVIDENCE=5, CONSEQUENCE=5, AUTONOMY=4, GAP=4, OWNER=5, CUBE FIT=5
TOTAL=28/30

---

### 2. Oracle + Salesforce Revenue Recognition Handoff

WORKFLOW:
Salesforce agent qualifies opportunity and creates quote.
Oracle agent books revenue and updates GL.

WHY INTERESTING:
PwC publicly described a global technology company where this pattern creates
cross-platform control gaps.

CUBE QUESTION:
Does any neutral verifier prove that the Salesforce-qualified opportunity
legitimately transitioned into Oracle-booked revenue?

OWNER HYPOTHESIS:
Revenue Controller / Head of Finance Systems / Internal Audit

SCORE:
EVIDENCE=5, CONSEQUENCE=5, AUTONOMY=5, GAP=5, OWNER=5, CUBE FIT=5
TOTAL=30/30

---

### 3. JPMorgan Agentic Corporate Treasury Clients

WORKFLOW:
AI treasury agent moves liquidity, FX, funding, or payments autonomously.

WHY INTERESTING:
JPMorgan publicly discussed an agent moving $340M at 3 a.m. and described
governance/accountability as still unresolved.

CUBE QUESTION:
What independent proof exists that an autonomous treasury action was within
delegated authority, policy, limits and state at execution time?

OWNER HYPOTHESIS:
CFO / Treasurer / CISO / Financial Risk Owner

SCORE:
EVIDENCE=5, CONSEQUENCE=5, AUTONOMY=5, GAP=5, OWNER=5, CUBE FIT=5
TOTAL=30/30

---

### 4. Agentic AP Platforms — ProcureDesk / Tipalti / Basware / Ramp

WORKFLOW:
Agents move from invoice extraction toward invoice-to-pay and payment release.

WHY INTERESTING:
ProcureDesk and others publicly discuss controls such as segregation of duties,
approval authority, three-way matching and audit trails.

CUBE QUESTION:
Is there an independent execution proof across invoice, approval, vendor,
amount, duplicate check and payment state — or do systems merely log it?

OWNER HYPOTHESIS:
Controller / AP Manager / Financial Systems Owner

SCORE:
EVIDENCE=5, CONSEQUENCE=5, AUTONOMY=4, GAP=4, OWNER=5, CUBE FIT=5
TOTAL=28/30

---

### 5. Mastercard Agent Pay for Machines Participants

WORKFLOW:
Machine-to-machine payments across Adyen, Stripe, Coinbase, Cloudflare,
Global Payments and others.

WHY INTERESTING:
Mastercard is building permissioning, transaction and settlement rails for
continuous machine payments.

CUBE QUESTION:
Who independently verifies that a machine-to-machine payment event was
authorized, policy-compliant and evidence-backed at the exact moment it settled?

OWNER HYPOTHESIS:
Payment Platform Risk Lead / Treasury / Compliance

SCORE:
EVIDENCE=5, CONSEQUENCE=5, AUTONOMY=5, GAP=4, OWNER=4, CUBE FIT=5
TOTAL=28/30

---

### 6. Visa Agentic Ready Enterprise Merchants

WORKFLOW:
Visa agent tokens, authenticated instructions and payment controls for agents.

WHY INTERESTING:
Visa is building trust infrastructure around agent identity and transaction
instructions.

CUBE QUESTION:
Does any current layer produce a portable, independent execution-proof artifact
that spans merchant, agent and payment network? Or is proof fragmented?

OWNER HYPOTHESIS:
Enterprise Payment Risk / AI Governance / Compliance

SCORE:
EVIDENCE=5, CONSEQUENCE=4, AUTONOMY=5, GAP=4, OWNER=4, CUBE FIT=5
TOTAL=27/30

---

### 7. Autonomous Procurement Agents — Zip / Coupa / Workday

WORKFLOW:
Agents discover vendors, negotiate, create purchase orders, route approvals,
and potentially trigger payment.

WHY INTERESTING:
Procurement is one of the highest-damage agentic finance workflows because
purchase order and payment state may span separate platforms.

CUBE QUESTION:
Can the organisation prove that a purchase-to-pay transition was independently
verified across procurement and AP systems?

OWNER HYPOTHESIS:
CPO / Financial Controller / Procurement Systems Owner

SCORE:
EVIDENCE=4, CONSEQUENCE=5, AUTONOMY=5, GAP=5, OWNER=5, CUBE FIT=5
TOTAL=29/30

---

### 8. Treasury Workstations — Kyriba / GTreasury / HighRadius

WORKFLOW:
AI agents support cash positioning, forecasting, payments, and liquidity actions.

WHY INTERESTING:
Treasury systems increasingly automate high-value financial actions but often
log rather than independently prove execution entitlement.

CUBE QUESTION:
When an agent recommends or triggers a treasury action, what neutral evidence
proves it was valid against policy and state?

OWNER HYPOTHESIS:
Treasurer / CFO / Internal Audit

SCORE:
EVIDENCE=4, CONSEQUENCE=5, AUTONOMY=4, GAP=5, OWNER=5, CUBE FIT=5
TOTAL=28/30

---

### 9. Stripe / Adyen Agentic Payment Ops

WORKFLOW:
Agent-managed payments, refunds, disputes, payout orchestration.

WHY INTERESTING:
These platforms are building strong controls, but their proof model is still
platform-native and may not extend across enterprise ERP/GL state changes.

CUBE QUESTION:
Can an enterprise prove a payout/refund state transition across payment,
ERP, GL and agent systems without relying on any one platform's logs?

OWNER HYPOTHESIS:
Payments Risk Lead / Finance Systems Lead / Compliance

SCORE:
EVIDENCE=5, CONSEQUENCE=4, AUTONOMY=5, GAP=4, OWNER=4, CUBE FIT=5
TOTAL=27/30

---

### 10. Multi-Agent ERP / CRM / Treasury Enterprise Deployments

WORKFLOW:
Salesforce + Oracle + SAP + ServiceNow + Treasury agent workflows.

WHY INTERESTING:
This is the PwC cross-platform control gap generalised. Most enterprises
will eventually run several agent platforms with financial handoffs.

CUBE QUESTION:
Where is the neutral seam that proves each handoff was valid before the next
system accepts new financial state?

OWNER HYPOTHESIS:
CFO / CISO / Enterprise AI Governance / Internal Audit

SCORE:
EVIDENCE=4, CONSEQUENCE=5, AUTONOMY=5, GAP=5, OWNER=5, CUBE FIT=5
TOTAL=29/30

---

## Top 3 Ranked

1. Oracle + Salesforce revenue recognition handoff — 30/30
2. JPMorgan agentic treasury — 30/30
3. Autonomous procurement / Zip-Coupa-Workday — 29/30

---

## Hard Boundary

CUBE ENGINEERING = FROZEN
CUBE DESIGN = FROZEN
BROWNEYE CORTEX = UNTOUCHED
DREAMLEDGER = UNTOUCHED

This is target discovery only.

It does not:

- modify CUBE
- unlock CUBE-01
- deploy anything
- claim revenue or customers
