# DreamLedger CD Release Package

Status: DEPLOY-READY / DEPLOYMENT-GATED

The repository now has a deterministic release package for the public commercial layer.

## Included

- Public IP manifest
- Market matrix
- Approval-gated social distribution playbook
- Permanent QR destination register
- Deterministic QR generator
- CI proof workflow

## Deployment gate

Actual production deployment requires an explicitly configured deployment provider and credentials. CI/CD must fail closed rather than invent a successful deployment when those credentials are absent.

## Revenue gate

A successful build or deployment does not change VERIFIED_REVENUE_NZD. Only independently verified payment evidence can do that.
