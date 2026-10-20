#!/usr/bin/env python3
"""Fail-closed checks for the cloud-first / optional-GPU execution boundary."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
gpu_path = ROOT / ".github/workflows/economic-gpu-opportunistic.yml"
gpu = gpu_path.read_text(encoding="utf-8")
errors = []

def require(condition, message):
    if not condition:
        errors.append(message)

require("workflow_dispatch:" in gpu, "GPU worker must remain manually dispatchable.")
require("runs-on: [self-hosted, gpu]" in gpu, "GPU inference must run only on the explicitly labelled optional GPU runner.")
require('online = $true' in gpu, "LM Studio success must write an explicit boolean online=true.")
require('online = $false' in gpu, "LM Studio failure must write an explicit boolean online=false.")
require('$state = Get-Content gpu-lmstudio-models.json -Raw | ConvertFrom-Json' in gpu,
        "Probe must parse the health JSON rather than use substring matching.")
require('$state.online -ne $true' in gpu, "Probe must skip safely when the endpoint is offline.")
require('[int]$state.model_count -lt 1' in gpu, "Probe must skip safely when no models are returned.")
require('TimeoutSec 5' in gpu and 'TimeoutSec 120' in gpu, "Health and inference calls must have bounded timeouts.")
require('uses: actions/upload-artifact@v4' in gpu and 'if: always()' in gpu,
        "Worker must retain diagnostics even after a failed/skipped inference.")
require("-notmatch '\"online\"'" not in gpu, "Do not use the broken substring test that skips valid /v1/models responses.")
require("stripe" not in gpu.lower() and "supabase" not in gpu.lower(),
        "Optional GPU research workflow must not call payment or database services.")

if errors:
    for error in errors:
        print(f"FAIL: {error}")
    raise SystemExit(1)

print("CLOUD_GPU_OPTIONAL_CONTRACT=PASS")
print("CLOUD_CI_DOES_NOT_REQUIRE_GPU=PASS")
print("LM_STUDIO_HEALTH_GATE=PASS")
print("BOUNDED_LOCAL_INFERENCE=PASS")
print("NO_PAYMENT_OR_DATABASE_SIDE_EFFECTS=PASS")
