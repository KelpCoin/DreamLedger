# BECK Daily Bootstrap: Diagnose → Council → One Commercial Action → 777

**Purpose:** one repeatable, evidence-first loop. Local inference and Supabase are independent systems. A healthy local council never substitutes for database health.

## Truth rules

- Local LM Studio may run while Supabase is broken. Prove each role with a real completion before calling the council ready.
- DreamLedger project `wbwgroygjeyukkspnqiy` remains the sole write authority until a verified recovery/restore and explicitly approved, fenced cutover.
- An HTTP response from the Supabase gateway is only reachability evidence. A 401/403 can mean the gateway answered but authentication is required; it does not prove Postgres or RPC health.
- If the fulfillment claim RPC returns non-2xx or HTTP 503, automated fulfillment stays **BLOCKED**. Do not promote an inactive clone or mark an order fulfilled.
- No model output, checkout session, PaymentIntent, internal row, generated page, or CI pass counts as revenue. Revenue remains zero until external payment settlement and fulfillment evidence are reconciled.
- This playbook does not send personal outreach, publish content, alter production, restart Supabase, or run a payment.

## Daily sequence

### 1. Read-only host and service diagnosis

From a Linux terminal in the DreamLedger checkout:

```bash
bash scripts/beck-daily-diagnose.sh
```

This reports OS, disk, memory, NVIDIA driver/GPU snapshot, LM Studio model-list endpoint, the public Proof Audit page HTTP status, Supabase REST gateway reachability, and Git/777-gate presence. It does **not** infer GPU inference, DB health, payment, or fulfillment from those checks.

On Windows, the existing read-only snapshot is:

```powershell
.\scripts\BECK-HOST-DIAGNOSTIC-READONLY.ps1
```

### 2. Start the local three-role council

Use the repository's Linux bootstrap after setting the exact model IDs shown by `lms ls`:

```bash
export BECK_SCOUT_MODEL='exact-model-id-from-lms-ls'
export BECK_CRITICAL_MODEL='exact-model-id-from-lms-ls'
export BECK_VISUAL_MODEL='exact-model-id-from-lms-ls'
bash BEC-PRIME/scripts/bootstrap-lmstudio-council-linux.sh
```

The bootstrap attempts real text inference for all three IDs and records local proof. It does not download models. **Important limitation:** text inference from the Visual model does not prove image understanding, and API visibility does not by itself prove all models are simultaneously resident in GPU memory. Check `lms ps` and `nvidia-smi`; report GPU acceleration and vision capability separately. If loading one model evicts another, the council is not a verified three-model resident set.

Do not copy placeholder IDs literally. Use the exact model IDs from the machine.

### 3. Run one bounded money-focused council cycle

Task: **improve the probability of one independent buyer purchasing an approved, deliverable offer in the next 48 hours, without inventing demand or revenue.**

- **Scout:** identify existing, admissible demand signals and the single strongest low-friction buyer problem. Include source URLs and timestamps. No invented buyers.
- **Critical:** challenge the evidence, price, scope, buyer trust, payment path, delivery burden, legal/support readiness, and any unverified assumptions. Return blockers plus practical fixes.
- **Synth:** produce at most seven concrete actions, ordered by expected commercial value and low human effort. Prefer inbound/public distribution if personal outreach is not wanted. Do not reopen architecture work unless a blocker directly prevents the sale.

Default commercial focus is one approved offer, not a catalogue expansion. Do not treat the Proof Audit as approved if its checkout is held. Do not send traffic to an offer until the live page, price, scope, payment link, support/contact and delivery process have been checked.

### 4. Execute one real commercial action

Choose one action you can actually complete today: repair a buyer-visible checkout blocker, improve the approved offer page, publish a useful sourced public artifact, or improve intake/delivery instructions. Do not claim execution for an action that was only suggested by a model.

If an external buyer pays, retain Stripe's settled-payment evidence, match it to the exact offer/order, deliver the promised work, and retain delivery evidence. If any link in that chain is missing, label it **UNVERIFIED** and do not count it as revenue.

### 5. 777 reconnaissance and compounding gate

Use actual source evidence. If there is an admissible new signal, make a concise public HTML pulse with source URLs, observation time, and an explicit `UNVERIFIED` revenue line. Do not publish private data or unsupported claims.

If no admissible signal or bounded component exists, use the 777 workflow's exact current-run no-op receipt contract. Do not create a fake public artifact merely to make CI green.

After the real artifact or valid no-op receipt has been produced, run the repository gate from the checkout:

```bash
python3 scripts/777_compounding_gate.py
```

The gate may fail if neither verified revenue evidence nor an eligible changed public artifact/current-run no-op receipt exists. That is an honest failure, not a reason to fabricate an artifact. Review the script's output and the workflow contract before changing its behavior.

### 6. End-of-day ledger

Record exactly five lines:

```text
DATE:
DONE:
BLOCKED:
ARTIFACTS:
REVENUE_VERIFIED_NZD: 0.00
NEXT:
```

Only update `REVENUE_VERIFIED_NZD` after settlement and fulfillment evidence have been independently reconciled. Keep Supabase health and local council readiness as separate statuses.

## Current blockers that this routine cannot magically clear

1. Supabase primary data-plane/RPC recovery: requires dashboard logs and, if necessary, Supabase support or a verified provider restore.
2. Clone parity: not proven while read-only schema/data checks return connection errors. Inactive projects are candidates, not standbys.
3. Production failover: requires replication/restore evidence, old-writer fencing, and explicit human approval.
4. Three-model GPU readiness: not proven until the actual Linux host runs the bootstrap and residency/GPU checks; visual capability needs an image-input test.
5. First sale: not proven until a real independent buyer pays and receives the promised deliverable.

**Operating order:** diagnose → prove local inference → one commercial action → 777 artifact or honest no-op → record truth. Do not make database recovery a prerequisite for local research, and do not let local research masquerade as a sale.


## One-command Windows startup (preferred)

From the DreamLedger repository root in Windows PowerShell, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\beck-startup.ps1
```

This orchestrator reuses the existing `beck-daily-bootstrap.ps1` and `beck-economic-bootstrap.ps1`. It does not replace either one. It writes a combined status receipt to `D:\\BrownEyeCortex\\Runtime\\proofs\\BECK-STARTUP-LATEST.json` when drive D: exists, otherwise under the user's home folder. Its transcript is `BECK-STARTUP-LATEST.log` beside that receipt.

The economic validator defaults to read-only checks and does not install packages. This repository branch does not commit `package-lock.json`, so `npm ci` is not valid; dependency installation is explicit with `-InstallDependencies` on the economic validator, and the CI workflow uses `npm install --no-package-lock`.

The webhook routing reconciler runs only when a local `STRIPE_SECRET_KEY` is present and `STRIPE_LIVE_ENABLED=true`. It only lists configured Stripe webhook endpoints and their event subscriptions. It does not create, edit, or disable endpoints. The inventory is not proof of delivery; confirm endpoint delivery history, function logs, successful database writes, order attribution, fulfillment, and customer delivery before declaring the money path complete.

Expected result: `PASS`, `BLOCKED`, or `FAIL`. A `BLOCKED` economic result is an honest report that a live dependency or commercial proof remains missing, not permission to invent a successful sale. Never paste a Stripe secret into ChatGPT or terminal output.
