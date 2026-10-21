# BECK local bootstrap contract (Windows)

**Classification:** internal operator material. Do not publish this document, internal system names, logs, or evidence paths on public storefronts.

## Scope and honest capability

This bootstrap starts the existing bounded North Star worker on the Windows user session. It is not a general-purpose shell agent, payment processor, email sender, public GPU service, or proof of commercial revenue. It deliberately does not install vibe-lm, satgate, an x402 facilitator, a public tunnel, a wallet, or a Stripe listener. No private key is accepted on the command line.

The worker is local-only by default:
- LM Studio API must bind only to `127.0.0.1:1234`.
- Remote/cloud reads are disabled.
- No customer contact, publishing, live payment action, cloud database write, or verified-revenue mutation is enabled.
- Models are reused/loaded only if already installed; the launcher will not download models silently.
- A healthy CI contract is not evidence that this PC has loaded models or completed a local cycle.

## The existing startup path

Use the `lms` CLI shipped with LM Studio. Official references:
- `lms server start`: https://lmstudio.ai/docs/cli/serve/server-start
- `lms daemon up` (starts llmster): https://lmstudio.ai/docs/cli/daemon/daemon-up
- Headless mode: https://lmstudio.ai/docs/developer/core/headless

This repository branch currently implements the desktop/session CLI path via `lms server start --port 1234 --bind 127.0.0.1`. Do not replace it with an assumed `llmster.exe` path without testing the installed Windows version. If using a clean headless llmster installation instead, first verify `lms --help`, `lms daemon status`, and the documented `lms daemon up` flow for that installation. Do not run two server implementations on port 1234.

## One-command preflight (PowerShell 5.1)

Run from the checked-out DreamLedger repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\runtime\lm_studio\Install-NorthStarSupervisorTask.ps1
```

This is a dry run. It parses dependencies via offline self-tests and makes no scheduled-task change unless the output passes and the operator deliberately reruns it with `-Install`.

To register a task for the current interactive user at logon, after reviewing the dry-run output:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\runtime\lm_studio\Install-NorthStarSupervisorTask.ps1 -Install
```

The task starts in an interactive user session at logon, not before a user logs into Windows. It is not a Windows Service that runs under LocalSystem at boot. This is intentional for this GPU/user-profile setup and avoids claiming unsupported service behavior.

## Verify actual health

The registration message is not a pass. Inspect the reported proof and logs, then confirm:
1. `LOCAL-NORTH-STAR-BOOT-LATEST.json` shows `MODELS_READY` and three distinct API-visible model IDs.
2. `http://127.0.0.1:1234/v1/models` returns HTTP 200 locally.
3. `supervisor-events.jsonl` contains `CYCLE_COMPLETE`, with a corresponding controller stdout/stderr artifact.
4. The priority task was consumed as valid, source-hashed evidence; a generic heartbeat by itself is not enough.
5. At least two successful observed cycles exist before claiming cycle continuity. Even that is not a guarantee of future uptime.
6. Verified external revenue remains NZ$0.00 unless a real independent buyer's settled payment, attribution, completed delivery, retrievable proof, and reconciliation all pass.

## Failure containment already implemented

- PowerShell and Python self-tests run before the task is registered.
- Task Scheduler uses `MultipleInstances IgnoreNew`; the Python supervisor also takes an OS-level single-instance lock.
- A controller cycle has a timeout; on Windows, the supervisor attempts to stop the child process tree and records a BLOCKED result.
- Invalid controller JSON and nonzero child exit status fail closed.
- Repeated failures use bounded exponential backoff; local proof is updated with BLOCKED status and failure reason.
- The launcher binds to loopback and disallows remote reads by default.

These controls require regression tests and PC commissioning. They are not proof of a production-grade unattended commercial operator.

## Not enabled by this bootstrap

No Stripe webhook server/listener, event signature verification, customer email service, quote extraction engine, satgate/Lightning backend, x402 facilitator, transaction-verification client, or public tunnel is installed or configured by this startup path. Do not instruct the local model to pretend those capabilities exist. If a separate deterministic commerce worker is added later, it must use an explicit least-privilege allowlist, verified signed events, idempotency, manual fulfillment approval, and write-once/reconcilable evidence. A facilitator's `SETTLED` label by itself is not proof of on-chain settlement.

## Red-team acceptance boundary

A red-team claim must be tested against the exact branch/file before being treated as a defect. This branch does not contain the alleged vibe-lm/satgate/WinSW bootstrap. Its actual scheduled task is interactive-user, task-level duplicate suppression plus Python OS lock; its actual runtime is local-only. The regression suite asserts these properties so a later change cannot silently expand scope.
