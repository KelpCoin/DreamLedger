# PUBLIC / PRIVATE BOUNDARY

Status: ACTIVE
Date: 2026-08-27

## Public surface

The public DreamLedger surface is intentionally narrow.

Allowed public product:
- 3000
- Public product facts required to buy 3000
- Public canvas/allocation state required to display the product
- Public checkout information
- Public proof summaries that do not disclose proprietary implementation

## Private material

The following are NOT public product material and must live in a private repository or private storage:
- BEC-PRIME source and internal architecture
- Amplissa material
- Adult material
- MTG / CollectorsCoast material
- Proprietary algorithms and decision logic
- Internal telemetry, pattern-matching methods and datasets
- Internal API designs and credentials
- Tokenisation and encryption implementation details
- Cryptocurrency or arbitrage research and execution logic
- Customer records and operational secrets
- Unreleased products, experiments and commercial strategy

## Hard rule

A public website must never import, expose, link to, or render private BEC material.

A public repository must be treated as readable by competitors. Removing a file from the current branch does not erase it from Git history.

Any credential that has ever been committed to a public repository must be considered exposed and rotated.

## Release rule

Only the 3000 public surface is release material until a separate release decision explicitly authorizes another product.

No automatic publication of internal documentation, source code, experiments or other silos is permitted.

## Current known risk

The DreamLedger repository is currently public. This boundary document does not make it private and does not rewrite Git history. Repository visibility and historical-secret remediation remain an owner action.
