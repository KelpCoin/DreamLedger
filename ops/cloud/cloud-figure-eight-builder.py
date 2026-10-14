#!/usr/bin/env python3
"""Bounded cloud Figure Eight builder. Never merges, deploys, or touches payment secrets."""
from __future__ import annotations
import datetime as dt, json, os, pathlib, re, subprocess, sys, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[2]
REPORT_DIR = ROOT / "proof" / "cloud-builder"
REPORT_PATH = REPORT_DIR / "latest.json"
MAX_CONTEXT_CHARS, MAX_PATCH_CHARS, MAX_CHANGED_FILES = 26000, 24000, 5
MODEL = os.environ.get("CLOUD_BUILDER_MODEL") or "gpt-4.1-mini"
PROTECTED = (".github/", "supabase/", "ops/commerce/", "ops/decision/", "BEC-PRIME/fulfillment/", "BEC-PRIME/catalog/offers/", "BEC-PRIME/config/", "BEC-PRIME/data/", "BEC-PRIME/proxy/", "BEC-PRIME/runtime/", "BEC-PRIME/evidence/")
ALLOWED_PREFIXES = ("docs/", "tests/", "ops/demand/", "ops/cube/", "BEC-PRIME/compiler/", "BEC-PRIME/scripts/", "runtime/777/")

def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def write_report(report):
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    report["generated_at"] = utc_now()
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as handle:
            handle.write("candidate-ready=" + ("true" if report.get("candidate_ready") else "false") + "\n")
    return report

def gh_get(url, token):
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "DreamLedger-Cloud-Figure-Eight"})
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))

def collect_failures(token, repo):
    if not token or not repo:
        return [{"status": "UNAVAILABLE", "detail": "GitHub token or repository context missing"}]
    try:
        runs = gh_get("https://api.github.com/repos/" + repo + "/actions/runs?per_page=30", token)
        failures = []
        for run in runs.get("workflow_runs", []):
            if run.get("conclusion") != "failure":
                continue
            failures.append({"name": run.get("name"), "workflow": run.get("path"), "branch": run.get("head_branch"), "sha": (run.get("head_sha") or "")[:12], "updated_at": run.get("updated_at"), "url": run.get("html_url"), "event": run.get("event")})
            if len(failures) >= 12:
                break
        return failures
    except Exception as exc:
        return [{"status": "UNAVAILABLE", "detail": "GitHub Actions inventory failed: " + type(exc).__name__}]

def read_context():
    pieces = []
    docs = [
        ("runtime/777/777-inversion-guardrails.md", 4200),
        ("docs/figure-eight-bootstrap-review.md", 3000),
        ("BEC-PRIME/architecture/FIGURE-EIGHT.md", 2300),
        ("BEC-PRIME/config/economic-supervisor.json", 1800),
        ("package.json", 2400),
    ]
    for rel, limit in docs:
        path = ROOT / rel
        if path.is_file():
            try:
                pieces.append("\n--- FILE: " + rel + " ---\n" + path.read_text(encoding="utf-8", errors="replace")[:limit])
            except OSError:
                pass
    sources = [
        ("BEC-PRIME/compiler/EconomicOpportunityCompiler.js", 2600),
        ("BEC-PRIME/scripts/777-public-market-radar.py", 2200),
        ("ops/demand/ingest-public-feeds.py", 2200),
        ("ops/cube/resolve-mechanisms.py", 2200),
        ("BEC-PRIME/scripts/Verify-FactoryFactoryCycle.js", 1800),
    ]
    for rel, limit in sources:
        path = ROOT / rel
        if path.is_file():
            try:
                pieces.append("\n--- SOURCE EXCERPT: " + rel + " ---\n" + path.read_text(encoding="utf-8", errors="replace")[:limit])
            except OSError:
                pass
    inventory = []
    for prefix in ("ops/demand", "ops/cube", "BEC-PRIME/compiler", "BEC-PRIME/scripts", "tests"):
        folder = ROOT / prefix
        if folder.is_dir():
            for path in sorted(folder.rglob("*")):
                if path.is_file() and not any(part in {".git", "node_modules", "__pycache__"} for part in path.parts):
                    inventory.append(path.relative_to(ROOT).as_posix())
    pieces.append("\n--- ALLOWLISTED FILE INVENTORY ---\n" + "\n".join(inventory[:220]))
    return "\n".join(pieces)[:MAX_CONTEXT_CHARS]

def api_patch(api_key, failures, context, repo):
    prompt = f"""You are the engineering worker inside DreamLedger's existing cloud Figure Eight.
Build incrementally; do not invent architecture or revenue. Goal: demand-first invoice/quote discrepancy detection and a reliable cloud build/repair loop. Invert supply-first agent building: prioritize real buyer problems and a complete paid delivery path over more listings or agents. Treat the user's competitor pricing and market-size claims as hypotheses, not proof of DreamLedger demand. The decisive experiment is a real invoice pair, an accurate discrepancy report, a legitimate independent buyer, a working payment path, and independently evidenced delivery. Prioritize conversion blockers over cosmetic infrastructure. Use the existing 70/20/10 hunt/convert/infra allocation doctrine where relevant.
Return JSON only with keys summary, rationale, patch. Patch must be a unified git diff string. If no safe, useful, testable patch can be made, return an empty patch.
Constraints: at most {MAX_CHANGED_FILES} files and {MAX_PATCH_CHARS} characters. Only modify/create files under docs/, tests/, ops/demand/, ops/cube/, BEC-PRIME/compiler/, BEC-PRIME/scripts/, runtime/777/. Never change workflows, package manifests, deployment, credentials, auth, database migrations, Stripe/payment/commerce, offer catalog, fulfillment, evidence ledger, or production configuration. Prefer a small executable improvement with tests over prose or a new framework. No dependencies or network calls. Never claim buyers, revenue, live execution, or market facts not evidenced here. Do not use synthetic invoices as evidence of real demand. Output standard unified diff applicable with git apply, including diff --git headers.
Repository: {repo}
Recent failed workflow metadata: {json.dumps(failures, indent=2)[:5000]}
Repository context:
{context}
"""
    body = {"model": MODEL, "temperature": 0.1, "max_tokens": 3500, "response_format": {"type": "json_object"}, "messages": [{"role": "system", "content": "You are a cautious autonomous software engineer. Follow patch boundaries exactly. JSON only."}, {"role": "user", "content": prompt}]}
    req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=json.dumps(body).encode("utf-8"), headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=90) as response:
        payload = json.loads(response.read().decode("utf-8"))
    result = json.loads(payload["choices"][0]["message"]["content"])
    patch = result.get("patch", "")
    if not isinstance(patch, str):
        raise ValueError("Model patch was not a string")
    if len(patch) > MAX_PATCH_CHARS:
        raise ValueError("Generated patch exceeds size cap")
    return result

def validate_paths(patch):
    paths = []
    for line in patch.splitlines():
        if line.startswith("diff --git "):
            match = re.match(r"diff --git a/(.+) b/(.+)$", line)
            if not match:
                raise ValueError("Malformed diff header")
            old, new = match.groups()
            if old != new:
                raise ValueError("Renames are not permitted")
            if new.startswith("/") or ".." in pathlib.PurePosixPath(new).parts:
                raise ValueError("Unsafe path in patch")
            if new.startswith(PROTECTED):
                raise ValueError("Protected path blocked: " + new)
            if not new.startswith(ALLOWED_PREFIXES):
                raise ValueError("Path outside builder allowlist: " + new)
            paths.append(new)
    unique = sorted(set(paths))
    if not unique:
        raise ValueError("Patch did not contain any file changes")
    if len(unique) > MAX_CHANGED_FILES:
        raise ValueError("Patch exceeds changed-file cap")
    return unique

def run(command):
    result = subprocess.run(command, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return result.returncode, result.stdout[-6000:]

def validate_candidate(paths):
    code, output = run(["git", "diff", "--check"])
    if code:
        raise RuntimeError("git diff --check failed:\n" + output)
    for rel in paths:
        if not (ROOT / rel).exists():
            continue
        if pathlib.Path(rel).suffix.lower() in {".js", ".mjs", ".cjs"}:
            code, output = run(["node", "--check", rel])
            if code:
                raise RuntimeError("JavaScript syntax failed for " + rel + ":\n" + output)
        elif pathlib.Path(rel).suffix.lower() == ".py":
            code, output = run([sys.executable, "-m", "py_compile", rel])
            if code:
                raise RuntimeError("Python syntax failed for " + rel + ":\n" + output)
    if any(p.startswith(("ops/demand/", "ops/cube/")) and p.endswith(".py") for p in paths):
        code, output = run([sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", "*test*.py"])
        if code:
            raise RuntimeError("Python unit tests failed:\n" + output)
    return {"diff_check": "PASS", "syntax_checks": "PASS", "python_tests": "PASS_OR_NOT_APPLICABLE"}

def main():
    token, repo = os.environ.get("GITHUB_TOKEN", ""), os.environ.get("GITHUB_REPOSITORY", "")
    failures = collect_failures(token, repo)
    report = {"schema": "dreamledger/cloud-figure-eight-builder/v1", "mode": "HUNT_ONLY", "repository": repo, "failures_seen": failures, "candidate_ready": False, "verified_external_revenue_nzd": 0, "human_gate": "REQUIRED_FOR_SECRET_CONFIGURATION_AND_ANY_PRODUCTION_FINANCIAL_CHANGE", "safety": {"merge": "NEVER", "deploy": "NEVER", "payment_or_external_contact": "NEVER", "changed_files_max": MAX_CHANGED_FILES, "patch_chars_max": MAX_PATCH_CHARS, "protected_paths": list(PROTECTED)}}
    enabled, api_key = os.environ.get("CLOUD_BUILDER_ENABLED", "").lower() == "true", os.environ.get("OPENAI_API_KEY", "")
    if not enabled or not api_key:
        report["next_action"] = "Set CLOUD_BUILDER_ENABLED=true and OPENAI_API_KEY as protected Actions settings to enable bounded model-assisted PR generation. Otherwise this run only inventories failed workflows."
        write_report(report)
        return 0
    report["mode"] = "MODEL_ASSISTED_PATCH_CANDIDATE"
    try:
        result = api_patch(api_key, failures, read_context(), repo)
        report["summary"] = str(result.get("summary", ""))[:1200]
        report["rationale"] = str(result.get("rationale", ""))[:2000]
        patch = result.get("patch", "")
        if not patch.strip():
            report["next_action"] = "No safe patch proposed; continue discovery."
            write_report(report)
            return 0
        paths = validate_paths(patch)
        REPORT_DIR.mkdir(parents=True, exist_ok=True)
        patch_path = REPORT_DIR / "candidate.patch"
        patch_path.write_text(patch, encoding="utf-8")
        code, output = run(["git", "apply", "--check", str(patch_path)])
        if code:
            raise RuntimeError("git apply --check rejected candidate:\n" + output)
        code, output = run(["git", "apply", str(patch_path)])
        if code:
            raise RuntimeError("git apply rejected candidate:\n" + output)
        report.update({"changed_files": paths, "checks": validate_candidate(paths), "candidate_ready": True, "next_action": "A bounded candidate passed local checks and may be opened as a pull request for independent CI/Gauntlet review. It is not merged or deployed."})
        write_report(report)
        return 0
    except Exception as exc:
        run(["git", "reset", "--hard", "HEAD"])
        report.update({"candidate_ready": False, "mode": "CANDIDATE_REJECTED", "error_type": type(exc).__name__, "error": str(exc)[:3000], "next_action": "Inspect rejection evidence; do not bypass the Gauntlet."})
        write_report(report)
        return 0

if __name__ == "__main__":
    raise SystemExit(main())
