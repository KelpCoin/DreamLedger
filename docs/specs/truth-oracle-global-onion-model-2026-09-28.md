# Truth Oracle Global Scope and Onion Access Model

Status: LOCKED INTERNAL SPECIFICATION
Date: 2026-09-28

## Scope correction

Gauntlet and Truth Oracle are separate systems with different scopes.

### Gauntlet

Gauntlet is internal-only.

Its purpose is to protect the DreamLedger / BrownEye economic funnel by qualifying or rejecting internal research-stage candidates before they consume further attention or approach the human external-action gate.

Its question is:

"Is this internal seed strong enough to keep?"

Gauntlet does not claim to determine the state of the wider world and does not answer global economic questions.

### Truth Oracle

Truth Oracle has global scope.

It is intended as a public, evidence-based reference layer for economically important reality. Its public outer surface is free, while deeper, higher-resolution, more historical, more computational, more persistent, or more operational access may be gated behind payment.

Its question is:

"What does the independently evidenced world currently support as true, false, or UNKNOWN?"

Examples of supported question classes include international trade constraints, landed-cost questions, regulatory facts, commodity and market conditions, and local economic data, provided they can be grounded in independent evidence.

The Oracle's truth state is independent of whether DreamLedger has a product or candidate attached to the question.

## Truth Oracle evidence rule

The Oracle must never invent missing evidence.

Every answer must distinguish at least:
- evidenced fact
- derived computation
- uncertainty
- UNKNOWN where evidence is insufficient or contradictory

Payment can unlock more evidence, greater resolution, history, derived views, query volume, or convenience. Payment cannot change the underlying truth calculation.

## Onion access model

### Layer 0: Public / Free

The outer public surface provides:
- high-level evidence-based statements
- UNKNOWN where evidence is missing
- basic definitions
- source citations
- coarse, delayed, or aggregated figures
- explicit evidence-quality/confidence notes where appropriate

No personalization, persistent alerts, export, or API access is included.

### Layer 1: Depth

A paid tier may provide:
- finer geographic or category granularity
- more recent observations
- approximately 12-24 months of basic history where source coverage supports it
- basic comparisons
- source-level confidence notes

This layer remains read-only with limited query volume and no persistent alerts or bulk export.

### Layer 2: Resolution + Computation

A higher paid tier may provide:
- high-resolution time series
- cross-source reconciliation views
- derived metrics such as spreads, differentials, rankings, and anomaly indicators
- saved filters
- modest CSV/JSON export for personal use
- higher query volume

Derived metrics are computations over evidenced inputs. They must not be presented as independently observed facts.

### Layer 3: Monitoring + Alerts

A higher paid tier may provide:
- persistent watches on entities or event classes
- threshold/change alerts
- faster refresh cadence
- larger historical windows
- saved workspaces and dashboards

The commercial value is notification and monitoring of evidenced changes, not alteration of the evidence.

### Layer 4: Professional / Bulk / API

A highest standard tier may provide:
- API access
- bulk historical extracts
- higher rate limits
- programmatic webhooks
- multi-user/team seats
- priority evidence-ingestion handling where operationally feasible

Target users include analysts, researchers, small firms, and automated systems requiring machine-readable economic evidence.

### Layer 5: Bespoke / Deep Custom

This is human-gated and not self-serve.

Potential services include:
- custom data partnerships or private feeds
- one-off deep investigations
- white-label or embedded Oracle instances
- unusually high-volume or low-latency requirements

No automated system may activate this layer without explicit human approval.

## Locked design invariants

1. Every layer reveals more resolution, history, computation, or access to evidence that exists. It does not manufacture truth.
2. Missing evidence remains UNKNOWN at every access layer.
3. Payment cannot create a buyer, settlement, or verified revenue event in DreamLedger's internal economic ledgers.
4. The Oracle's internal truth state is independent of the user's access tier.
5. Gauntlet governs internal research candidates only.
6. Truth Oracle governs global evidence questions, including questions unrelated to DreamLedger products.
7. Derived computations must retain provenance to their underlying evidenced inputs.
8. Conflicting sources must remain explicitly represented rather than silently collapsed into certainty.
9. Layer access is an entitlement decision, not a truth decision.
10. Layer 5 always requires the human external-action gate.

## Relationship to DreamLedger

Internal candidate:
Elohim -> Gauntlet -> CUBE -> human gate if external action is required.

World economic question:
Truth Oracle -> public evidence -> optional deeper paid evidence/computation/access.

An internal candidate may consume Oracle data as evidence, subject to provenance rules. It cannot claim the Oracle's public facts as its own verified external revenue.

## Commercial truth boundary

Truth Oracle access revenue, if and when a real external customer pays for it, is a separate commercial event from the truth claims the Oracle produces.

A real paid Oracle subscription or query does not make any underlying economic proposition true. Conversely, an economic proposition being true does not imply that anyone paid for Oracle access.

DreamLedger's existing Truth Oracle revenue counters remain governed by the independent external payment, attribution, fulfilment, and proof requirements already locked.

## Status

This specification is a future monetisation and product-access model, not evidence that any tier is live, sold, or generating revenue.

Current verified external revenue remains NZ$0.00.
