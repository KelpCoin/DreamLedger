# BEC-KINGDOM ACCOUNTING

## Initial revenue ladder

1. ACCOUNTING-DIAGNOSTIC-NZD-29: one-off diagnostic.
2. ACCOUNTING-APAR-NZD-149: one-off reconciliation setup.
3. ACCOUNTING-BOOKKEEPER-NZD-499-MONTHLY: recurring bookkeeping service.
4. ACCOUNTING-MCP-NZD-99-MONTHLY: recurring tool/API access.

## Control boundary

The ACCOUNTING silo may import, classify, reconcile, close, and draft tax outputs. It must not autonomously make live payments or submit tax filings. Those actions require explicit human approval.

## Fulfilment loop

Payment verified -> customer/job record created -> accounting intake -> classification -> reconciliation -> exception queue -> human approval where required -> deliverable -> proof artifact -> revenue event.

## Proof requirement

Every production worker run emits a SHA-256 proof artifact. Revenue is not considered verified until the payment event and fulfilment proof both exist.

## Local worker

BEC-PRIME/accounting/Worker-Accounting.ps1

Expected local proof directory:

D:\BrownEyeCortex\PROOF\ACCOUNTING

## Stripe integration

The Stripe connector is currently available for integration planning but does not expose product/price creation in this session. Do not invent Stripe IDs. When product-write capability is available, create the four offers above and connect verified payment events to fulfilment.

## 60-second verification

From PowerShell:

Set-Location D:\BrownEyeCortex
.\ACCOUNTING\Worker-Accounting.ps1
Get-ChildItem D:\BrownEyeCortex\PROOF\ACCOUNTING | Sort-Object LastWriteTime -Descending | Select-Object -First 1

For the repository control plane, verify that BEC-PRIME/autonomy/SILO-REGISTRY.json contains id=ACCOUNTING and that public_actions_require_human_approval remains true.
