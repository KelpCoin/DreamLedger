# Render Deployment Module

Permanent DreamLedger deployment helper for Windows PowerShell 5.1.

## Purpose

- Deploy an exact Git commit through the Render API.
- Optionally clear the Render build cache.
- Optionally wait for https://dreamledger.org/version to converge to the requested commit.
- Verify production health and configurator availability.
- Write immutable local proof JSON to D:\DreamLedger\PROOFS\Render.
- Never stores the Render API key in the repository.

## Usage

From BEC-PRIME:

powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-RenderDeploy.ps1 -ServiceId srv-xxxxx -ClearCache -WaitForProduction

For a normal deploy without cache clearing:

powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-RenderDeploy.ps1 -ServiceId srv-xxxxx -WaitForProduction

To verify only:

powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-RenderDeploy.ps1 -ServiceId srv-xxxxx -VerifyOnly

The API key can be supplied through RENDER_API_KEY or entered securely when prompted.

## Contract

Render deploys are made against the exact current Git commit unless -CommitSha is supplied.

Production truth requires:

- /healthz returns HTTP 200
- /version returns HTTP 200
- /api/mtg/configurator/decks returns HTTP 200
- /version.commit exactly matches the requested Git commit

A failed convergence is a failed deployment proof, not a success.

## 60-second verification

powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-RenderDeploy.ps1 -ServiceId srv-xxxxx -VerifyOnly
