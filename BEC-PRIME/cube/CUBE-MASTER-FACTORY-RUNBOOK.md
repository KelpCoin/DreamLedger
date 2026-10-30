# BECK CUBE v2 | CUBE private compiler and KelpHaven game boundary

Effective owner priority: 2026-10-30. This runbook supersedes any quote-comparison-first sales missions. Free value and useful experiences attract traffic. Truth Oracle owns comparison tools. Never auto-promote QUOTE-COMPARE-49. Do not merge draft PR #897 or post a paid offer from an older prompt.

## Existing, not replacement architecture

1. Existing CUBE v2 generator: `BEC-PRIME/cube/clone-silo.js`. Domain-neutral commerce, community and evidence shape only.
2. CUBE adapter: `BEC-PRIME/cube/cube-batch.js`. Uses the existing compiler; accepts a JSON `CUBE/BATCH-QUEUE/v1` with 1-25 jobs, task_id and fully self-contained config. Generates four inactive private files per silo and `cube-proof.json`, SHA256 and HOLD state. No public catalogue, inventory, credentials, automatic pricing, posting or checkout.
3. Example: `BEC-PRIME/cube/examples/cube-free-first.example.json`. Two unrelated inputs: free-tool discovery and a KelpHaven *commerce/identity* candidate, not game source.
4. Godot adapter: `BEC-PRIME/cube/godot-workspace-audit.js` audits the EXISTING Godot project and emits structure-only evidence. It never executes the game, modifies project code or claims a verified playable build.
5. Game contract: `BEC-PRIME/cube/KELPHAVEN-GODOT-ADAPTER-CONTRACT.json`. Actual Godot import, gameplay regressions, persistence, avatar cache + text-emoji fallback, PvE AI, customer entitlements and private package proof are distinct unverified stages.

## CUBE compile, from DreamLedger repo

```powershell
Set-Location 'C:\Users\GGPC\DreamLedger-NorthStar-PR705-dd3ef592'
node 'BEC-PRIME\cube\cube-batch.js' 'BEC-PRIME\cube\examples\cube-free-first.example.json' 'D:\BrownEyeCortex\Runtime\Proofs\CUBE-private-batch-001'
if ($LASTEXITCODE -ne 0) { throw 'CUBE_CUBE_COMPILE_FAILED' }
```

This requires the branch containing the new adapter files. If the local checkout does not contain them, do not run a stale older copy or overwrite an existing batch. Running the same queue again is idempotent; changing it requires a NEW private output folder. Never use `public/` as a destination.

## Godot static audit, from the repo

```powershell
node 'BEC-PRIME\cube\godot-workspace-audit.js' 'D:\BrownEyeCortexData\MMOEngine\GodotClient'
if ($LASTEXITCODE -ne 0) { throw 'KELPHAVEN_GODOT_SOURCE_AUDIT_FAILED' }
```

Only checks file structure. No runtime execution, scene import or readiness claim. Godot 4 runtime and working project are external local prerequisites.

## Approval, safety and commercial truth

- Every CUBE output is a private candidate with empty sellable stock, nonpublic status and disabled checkout. The original silo is a reference fixture, never a source of copied data.
- Never pass Stripe, Supabase, Neon, live inventory, customer lists, mailboxes or creator-community data into swarm task configs.
- No automatic TikTok/Metricool publication, budget spending, live checkout, Stripe object mutation or merge.
- Priority: free DreamLedger utility, DreamMeez/KelpHaven previews and independently demonstrable owner-light upgrades. Quote comparisons are free Truth Oracle capability, NOT a commercial acquisition target.
- Any revenue claim requires a real external buyer, settled attributable payment, fulfilled deliverable and independent evidence.
- The compiler is not a game generator: a finished KelpHaven game requires actual Godot source, scene/AI/combat/save/avatar work and a tested runnable build. Keep its game build pipeline separate from commerce authorization.
