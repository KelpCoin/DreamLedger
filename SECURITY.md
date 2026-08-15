# Security Policy

## Security boundary

DreamLedger is a public repository. Public code must never contain secrets, payment credentials, private customer data, private product corpora, or unpublished proprietary evidence.

## Non-negotiable controls

1. Human authority is final.
2. Automated agents may propose and validate changes but may not weaken constitutional guardrails.
3. Production-affecting changes require CI evidence before merge.
4. Payment, identity, authentication, authorization, and webhook verification paths are security-sensitive.
5. Silo boundaries are security boundaries. Cross-silo state must be explicit and policy-authorized.
6. Evidence must distinguish PROPOSED, EXECUTED, VERIFIED, PAID, and PROFITABLE.
7. Emergency stop controls must fail closed.
8. Public actions remain approval-gated unless a specific policy explicitly permits automation.
9. Secrets belong in the deployment secret manager or local protected storage, never source control.
10. Security fixes must not silently change commercial identity, pricing, ownership, or approval policy.

## Reporting

For a suspected vulnerability, do not publish credentials, tokens, private customer information, or exploit details in a public issue. Use the repository owner's private security reporting channel where available.

## Scope

This policy applies to the repository and all automated workflows derived from it. Vertical-specific rules remain in their silo policy files. Universal governance rules may only be strengthened, never weakened, by downstream policy.
