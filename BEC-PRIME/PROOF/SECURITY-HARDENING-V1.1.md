# BECKPrime Security Hardening v1.1

Status: PRE-DEPLOYMENT HARDENED BRANCH

## Authority chain

Gemma -> MCP -> DreamLedger Gateway -> Economic Court -> Human Approval -> Executor

Gemma never receives economic authority. The MCP gateway exposes six allowlisted tools. Checkout and offer operations are proposal-only. Autonomous spend is zero.

## MCP boundary

The local gateway is intended to run in a Docker sandbox with:

- no network
- read-only container filesystem
- read-only product and proof mounts
- a dedicated writable audit volume only
- dropped Linux capabilities
- no-new-privileges
- no shell execution
- no direct Stripe calls

For local stdio MCP, OAuth is not a substitute for process isolation. OAuth applies to network authorization flows. The sandbox and command pinning protect the local process boundary.

## Tool integrity

Tool definitions are pinned by SHA-256. A manifest mismatch is a hard failure. Tool descriptions contain no hidden operational instructions. Changes require a new verification event and re-approval.

## Economic Court

States:

PROPOSED -> COURT_CHECKED -> AWAITING_HUMAN_APPROVAL -> HUMAN_APPROVED -> EXECUTABLE -> EXECUTED -> PROOFED

Blocked proposals terminate at BLOCKED. There is no autonomous transition from PROPOSED to EXECUTED.

Approval tokens are scoped to proposal hash, SKU, amount, currency, silo, expiry and nonce and are Ed25519/RSA-signature-ready through the configured Node crypto signing interface.

## Public surface

The public website exposes only commercial truth and a security explanation. Control-plane mutation routes require a server-side control token. Internal trust verification remains separately authenticated.

## Verification

`npm run verify:security`

`npm run compile:mirror`

`node BEC-PRIME/scripts/verify-public-surface.js`

## Economic truth

RA_000001 is not claimed by architecture or deployment. It remains the first independently verified stranger payment with settlement evidence.
