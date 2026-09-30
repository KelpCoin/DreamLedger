#!/usr/bin/env python3
"""Figure Eight local runtime capability proof.

This script performs evidence-producing runtime checks only. It never contacts
buyers, changes prices, creates payments, or publishes anything.
"""

import argparse
import datetime as dt
import hashlib
import json
import os
import subprocess
import urllib.request


def run_lms(lms, argv, timeout=300):
    p = subprocess.run([lms, *argv], capture_output=True, text=True, timeout=timeout)
    if p.returncode:
        raise RuntimeError((p.stderr or p.stdout)[-4000:])
    return p.stdout


def sha(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def post(url, model):
    body = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": "Return JSON only. State exactly: runtime proof response."},
            {"role": "user", "content": "Respond with {"runtime_proof":true,"stage":"capability"}."}
        ],
        "temperature": 0
    }).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read().decode("utf-8")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--lms", default=None)
    p.add_argument("--url", default="http://127.0.0.1:1234/v1/chat/completions")
    p.add_argument("--models", required=True, help="Two comma-separated local model keys")
    p.add_argument("--gpu", default="0.35")
    p.add_argument("--context-length", type=int, default=4096)
    p.add_argument("--out", default=os.path.join("BEC-PRIME", "data", "runtime-proof"))
    args = p.parse_args()

    import shutil
    lms = args.lms or shutil.which("lms") or shutil.which("lms.exe")
    if not lms:
        raise RuntimeError("lms executable not found")

    models = [x.strip() for x in args.models.split(",") if x.strip()]
    if len(models) < 2:
        raise RuntimeError("Provide at least two local model keys")

    os.makedirs(args.out, exist_ok=True)
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    evidence = {
        "schema_version": "BEC-RUNTIME-PROOF-1.0",
        "claim_boundary": "RUNTIME_CAPABILITY_ONLY",
        "started_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "lms_path": lms,
        "server": None,
        "models_available": None,
        "stages": []
    }

    evidence["server"] = json.loads(run_lms(lms, ["server", "status", "--json", "--quiet"]))
    if not evidence["server"].get("running"):
        run_lms(lms, ["server", "start", "--port", "1234"])
        evidence["server"] = json.loads(run_lms(lms, ["server", "status", "--json", "--quiet"]))

    available_raw = run_lms(lms, ["ls", "--llm", "--json"])
    try:
        evidence["models_available"] = json.loads(available_raw)
    except json.JSONDecodeError:
        evidence["models_available_raw"] = available_raw[-8000:]

    for i, model in enumerate(models[:2], 1):
        run_lms(lms, ["unload", "--all"], timeout=120)
        before = run_lms(lms, ["ps", "--json"])
        run_lms(lms, ["load", model, "--gpu", args.gpu, "--context-length", str(args.context_length), "--yes"])
        loaded = run_lms(lms, ["ps", "--json"])
        response = post(args.url, model)
        response_hash = sha(response)
        run_lms(lms, ["unload", "--all"], timeout=120)
        after = run_lms(lms, ["ps", "--json"])
        evidence["stages"].append({
            "sequence": i,
            "model": model,
            "before_loaded_state": before,
            "loaded_state": loaded,
            "http_response_sha256": response_hash,
            "http_response_bytes": len(response.encode("utf-8")),
            "after_unload_state": after
        })

    evidence["completed_utc"] = dt.datetime.now(dt.timezone.utc).isoformat()
    evidence["runtime_proof"] = "PASS"
    path = os.path.join(args.out, "RUNTIME-PROOF-" + stamp + ".json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(evidence, f, indent=2, ensure_ascii=False)
    print(json.dumps({"runtime_proof": "PASS", "artifact": path}, indent=2))


if __name__ == "__main__":
    main()
