# MONEY-06 Agentic Commerce Surface Test

Purpose: convert the $49 offer from a generic audit into a reproducible commercial test.

## TEST THE HARDEST SKU FIRST

For each qualified merchant select one high-value or high-complexity product/service.

Record:

- canonical URL
- exact product/service name
- displayed price
- variants/options
- stock/availability signal
- delivery/pickup constraints
- refund/returns signal
- purchase/enquiry action
- structured data visible to a machine

## THREE TESTS

### 1. UNDERSTAND
Can a machine extract the correct identity, price, options and constraints without guessing?

PASS only when the critical facts agree with the human-facing surface.

### 2. DECIDE
Can a machine determine whether the offer satisfies a stated buyer requirement?

Use a deterministic test question, for example: "Which option meets requirement X while costing less than Y?"

PASS only when the answer can be justified from merchant evidence.

### 3. ACT
Can the machine reach the appropriate commercial action without encountering an avoidable ambiguity?

PASS only when the intended product/service, option and next action remain unambiguous.

## EVIDENCE RULE

Capture the URL, timestamp, observed fact, expected fact, result and evidence location.

Never claim an agent completed a purchase unless a real transaction exists.
Never claim lost sales, conversion uplift or protocol certification without evidence.

## COMMERCIAL OUTPUT

The customer receives:

1. Executive finding
2. Three test results
3. Evidence table
4. Highest-impact gaps
5. Prioritized fixes
6. Verification procedure

The output is diagnosis, not a vanity score.

## PRICE

NZD 49.

Follow-on services are offered only after delivery and only when the evidence supports a genuine implementation need.

## SUCCESS EVENT

FIRST_PAYMENT_PROOF = real payment + verified transaction_id + delivered audit artifact.
