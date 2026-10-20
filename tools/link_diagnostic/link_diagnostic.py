#!/usr/bin/env python3
"""link_diagnostic.py - Stripe payment-link & checkout-configuration diagnostic. Stdlib only, offline, deterministic, NO AI.
Input: a read-only export of a merchant's Stripe payment links (+ optional rules JSON). Output: a findings report with the exact fix for each problem.
It reviews CONFIGURATION ONLY: it does not test a live payment, contact Stripe, or prove that an order, delivery or webhook works. It uses link metadata, redirect URLs and flags,
never customer data. Two views of the same result: FREE (verdict + the TYPES of problems; commitments to the detail) and FULL (every link, every fix). The free view carries the
SHA-256 of the full report, so what you later reveal can be checked against what you showed first. Paying shows more of the truth; it can never change it.

  python link_diagnostic.py links.json --rules rules.json --out report_dir
rules.json (all optional): {\"required_metadata_any\": [\"sku_id\",\"sku\"], \"expected_currency\": \"nzd\", \"excluded_terms\": [], \"allowed_redirect_hosts\": [], \"require_redirect\": true, \"redirect_needs_session_placeholder\": false}"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

VERSION = "1.0.0"
MAX_BYTES = 5 * 1024 * 1024
SEV = {"HIGH": 3, "MEDIUM": 2, "LOW": 1, "INFO": 0}
DISCLAIMER = ("Static configuration review of the export you supplied. It does not test a live payment and does not prove that webhooks, orders, entitlements or delivery work. "
              "It is not legal, tax, security or compliance advice. Findings are only as complete as the export.")
FIX = {
    "MISSING_REQUIRED_METADATA": "Add one of the required metadata keys to the LINK's own metadata (Payment Link > Metadata). Checkout sessions copy the link's metadata, so a webhook that reads it will see nothing otherwise.",
    "METADATA_ONLY_ON_PAYMENT_INTENT": "The key exists only under payment_intent_data.metadata, which lands on the PaymentIntent and NOT on the Checkout Session. Put it in the link's metadata (or make the handler read the PaymentIntent).",
    "CURRENCY_MISMATCH": "Make the link currency match what your settlement handler accepts, or extend the handler deliberately. A paid session in the wrong currency is usually rejected.",
    "NO_AFTER_COMPLETION_REDIRECT": "The buyer lands on Stripe's generic confirmation with no pointer to delivery. Set a redirect to your delivery or access page.",
    "REDIRECT_NOT_HTTPS": "Use an https redirect URL.", "REDIRECT_LOCAL_OR_PLACEHOLDER": "The redirect points at localhost or a placeholder domain: replace it with the real delivery URL.",
    "REDIRECT_HOST_NOT_ALLOWED": "The redirect host is not in your allowed list: check for a stale or typo'd domain.",
    "REDIRECT_MISSING_SESSION_PLACEHOLDER": "Your delivery page needs the checkout session id: add {CHECKOUT_SESSION_ID} to the redirect URL.",
    "DUPLICATE_ACTIVE_LINKS": "Several active links carry the same product identifier, so it is unclear which one is canonical. Deactivate the extras, keeping the one your site and webhook expect.",
    "EXCLUDED_TERM": "The link mentions a term you excluded: review whether it should be live.", "MANUAL_FULFILMENT_DECLARED": "Metadata says fulfilment is manual: confirm someone is assigned to deliver, or automate it.",
    "LINK_INACTIVE": "Inactive links cannot take payments. If it is still shared anywhere, buyers will hit the inactive message.", "NO_INACTIVE_MESSAGE": "Add a custom inactive message so a buyer on an old URL sees what to do next."
}


def canon(v) -> str: return json.dumps(v, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
def sha(s) -> str: return hashlib.sha256(s if isinstance(s, bytes) else s.encode()).hexdigest()


def load_links(raw: bytes) -> list[dict]:
    if len(raw) > MAX_BYTES: raise ValueError("export too large (5 MB cap)")
    d = json.loads(raw.decode("utf-8"))
    if isinstance(d, list) and d and isinstance(d[0], dict) and isinstance(d[0].get("text"), str):
        d = json.loads(d[0]["text"])
    links = d.get("data") if isinstance(d, dict) else d
    if not isinstance(links, list) or not all(isinstance(x, dict) for x in links): raise ValueError("expected a Stripe list object or an array of payment links")
    return links


def check_link(l: dict, r: dict) -> list[dict]:
    f, md = [], l.get("metadata") or {}
    pim = (l.get("payment_intent_data") or {}).get("metadata") or {}
    add = lambda code, sev, detail="": f.append({"code": code, "severity": sev, "detail": detail})
    if l.get("active") is not True:
        add("LINK_INACTIVE", "INFO")
        if not l.get("inactive_message"): add("NO_INACTIVE_MESSAGE", "LOW")
        return f
    keys = r.get("required_metadata_any") or []
    if keys and not any(md.get(k) for k in keys):
        if any(pim.get(k) for k in keys): add("METADATA_ONLY_ON_PAYMENT_INTENT", "HIGH", "key found on payment_intent_data only")
        else: add("MISSING_REQUIRED_METADATA", "HIGH", "none of: " + ", ".join(keys))
    cur = r.get("expected_currency")
    if cur and l.get("currency") and str(l["currency"]).lower() != str(cur).lower(): add("CURRENCY_MISMATCH", "HIGH", f"link {l['currency']} vs expected {cur}")
    ac = l.get("after_completion") or {}; url = (ac.get("redirect") or {}).get("url", "") if ac.get("type") == "redirect" else ""
    if not url:
        if r.get("require_redirect", True): add("NO_AFTER_COMPLETION_REDIRECT", "MEDIUM")
    else:
        u = urlparse(url); host = u.hostname or ""
        if u.scheme != "https": add("REDIRECT_NOT_HTTPS", "MEDIUM")
        if host in ("localhost", "127.0.0.1", "example.com", "example.org", "yourdomain.com") or host.endswith(".invalid") or host.endswith(".local"): add("REDIRECT_LOCAL_OR_PLACEHOLDER", "HIGH", host)
        if r.get("allowed_redirect_hosts") and host not in r["allowed_redirect_hosts"]: add("REDIRECT_HOST_NOT_ALLOWED", "MEDIUM", host)
        if r.get("redirect_needs_session_placeholder") and "{CHECKOUT_SESSION_ID}" not in url: add("REDIRECT_MISSING_SESSION_PLACEHOLDER", "MEDIUM")
    blob = canon([l.get("id"), md, pim, l.get("custom_text")]).lower()
    for t in r.get("excluded_terms") or []:
        if str(t).lower() in blob: add("EXCLUDED_TERM", "MEDIUM", str(t))
    if str(md.get("fulfillment", "")).lower().startswith("manual"): add("MANUAL_FULFILMENT_DECLARED", "LOW")
    return f


def diagnose(links: list[dict], rules: dict | None = None, raw_sha: str = "") -> dict:
    r, rows, active = rules or {}, [], [l for l in links if l.get("active") is True]
    for l in links:
        fs = check_link(l, r)
        rows.append({"link_id": l.get("id"), "active": l.get("active") is True, "findings": fs, "verdict": max((x["severity"] for x in fs), key=lambda s: SEV[s], default="OK") if fs else "OK"})
    groups: dict = {}
    for l in active:
        md = l.get("metadata") or {}
        k = next((md[x] for x in (r.get("required_metadata_any") or ["sku_id", "sku", "dreamledger_sku", "offer_id"]) if md.get(x)), None)
        if k: groups.setdefault(str(k), []).append(l.get("id"))
    for k, ids in sorted(groups.items()):
        if len(ids) > 1:
            for row in rows:
                if row["link_id"] in ids: row["findings"].append({"code": "DUPLICATE_ACTIVE_LINKS", "severity": "MEDIUM", "detail": f"{len(ids)} active links share '{k}'"}); row["verdict"] = max([row["verdict"], "MEDIUM"], key=lambda s: SEV.get(s, -1))
    counts: dict = {}
    for row in rows:
        for x in row["findings"]: counts[x["code"]] = counts.get(x["code"], 0) + 1
    sev = {s: sum(1 for row in rows for x in row["findings"] if x["severity"] == s) for s in SEV}
    return {"engine": "link_diagnostic " + VERSION, "input_sha256": raw_sha, "rules": r, "links_reviewed": len(links), "active_links": len(active), "links_with_problems": sum(1 for x in rows if x["verdict"] not in ("OK", "INFO")),
            "severity_counts": sev, "finding_counts": dict(sorted(counts.items())), "links": rows, "fixes": {c: FIX[c] for c in sorted(counts) if c in FIX}, "disclaimer": DISCLAIMER}


def free_view(full: dict) -> dict:
    return {"engine": full["engine"], "links_reviewed": full["links_reviewed"], "active_links": full["active_links"], "links_with_problems": full["links_with_problems"], "severity_counts": full["severity_counts"],
            "finding_counts": full["finding_counts"], "commitment_sha256_of_full_report": sha(canon(full)), "disclaimer": DISCLAIMER}


def verify_commitment(free: dict, full: dict) -> bool:
    return free.get("commitment_sha256_of_full_report") == sha(canon(full)) and all(free[k] == full[k] for k in ("links_reviewed", "active_links", "links_with_problems", "severity_counts", "finding_counts"))


def to_markdown(rep: dict, tier: str = "full") -> str:
    s = rep["severity_counts"]; L = ["# Payment-link diagnostic", "", f"Links reviewed: {rep['links_reviewed']} (active: {rep['active_links']}). Links with problems: {rep['links_with_problems']}.",
                                    f"Findings: HIGH {s['HIGH']}, MEDIUM {s['MEDIUM']}, LOW {s['LOW']}, INFO {s['INFO']}.", "", "## Problem types"]
    L += [f"- {c}: {n}" for c, n in rep["finding_counts"].items()] or ["- none"]
    if tier == "full":
        L += ["", "## How to fix each type"] + [f"- **{c}**: {t}" for c, t in rep["fixes"].items()] + ["", "## Per link"]
        for row in rep["links"]:
            if row["findings"]: L += [f"- `{row['link_id']}` ({row['verdict']}): " + "; ".join(f"{x['code']}" + (f" ({x['detail']})" if x["detail"] else "") for x in row["findings"])]
    else: L += ["", f"The detailed per-link list and fixes are in the full report. Commitment to it: `{rep['commitment_sha256_of_full_report']}`"]
    return "\n".join(L + ["", "_" + rep["disclaimer"] + "_", ""])


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Offline Stripe payment-link diagnostic"); ap.add_argument("links"); ap.add_argument("--rules"); ap.add_argument("--out", default="diagnostic_out"); a = ap.parse_args(argv)
    try:
        raw = Path(a.links).read_bytes(); links = load_links(raw); rules = json.loads(Path(a.rules).read_text()) if a.rules else {}
    except (ValueError, OSError) as e:
        print(f"error: {e}", file=sys.stderr); return 2
    full = diagnose(links, rules, sha(raw)); free = free_view(full); out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    (out / "report_full.json").write_text(json.dumps(full, indent=1, sort_keys=True)); (out / "report_free.json").write_text(json.dumps(free, indent=1, sort_keys=True))
    (out / "report_full.md").write_text(to_markdown(full, "full")); (out / "report_free.md").write_text(to_markdown(free, "free"))
    print(json.dumps({k: free[k] for k in ("links_reviewed", "active_links", "links_with_problems", "severity_counts", "finding_counts")}, indent=1)); return 0


if __name__ == "__main__":
    sys.exit(main())
