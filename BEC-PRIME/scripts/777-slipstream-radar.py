#!/usr/bin/env python3
"""777 SLIPSTREAM public progress radar.

Research-only: observes public signals and extracts candidates for later
qualification. It does not contact sellers, spend money, execute transactions,
or claim revenue.
"""
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone

OUT = "BEC-PRIME/data/777/777-SLIPSTREAM-LATEST.json"
UA = "DreamLedger-777-Slipstream/1.0"

QUERIES = [
    "agentic commerce payments",
    "AI agent procurement supplier verification",
    "machine payment API verification",
    "proof of fulfillment receipts agents",
    "AI automation business payment",
    "public records data API business",
    "security bounty automation agent",
]

def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)

def github_search(q):
    url = "https://api.github.com/search/repositories?" + urllib.parse.urlencode({
        "q": q + " pushed:>=2026-09-01",
        "sort": "updated",
        "order": "desc",
        "per_page": "8",
    })
    data = get_json(url)
    return [{
        "name": x.get("full_name"),
        "description": x.get("description"),
        "url": x.get("html_url"),
        "updated_at": x.get("updated_at"),
        "stars": x.get("stargazers_count", 0),
    } for x in data.get("items", [])]

def hn_search(q):
    url = "https://hn.algolia.com/api/v1/search_by_date?" + urllib.parse.urlencode({
        "query": q, "tags": "story", "hitsPerPage": "8"
    })
    data = get_json(url)
    return [{
        "title": x.get("title"),
        "url": x.get("url") or ("https://news.ycombinator.com/item?id=" + str(x.get("objectID"))),
        "created_at": x.get("created_at"),
        "points": x.get("points", 0),
    } for x in data.get("hits", [])]

def main():
    generated = datetime.now(timezone.utc).isoformat()
    candidates = []
    errors = []
    for q in QUERIES:
        for source, fn in (("github", github_search), ("hacker_news", hn_search)):
            try:
                for item in fn(q):
                    candidates.append({"query": q, "source": source, **item})
            except Exception as e:
                errors.append({"query": q, "source": source, "error": str(e)[:240]})

    seen = set()
    unique = []
    for x in candidates:
        key = (x["source"], x.get("url") or x.get("name") or x.get("title"))
        if key not in seen:
            seen.add(key)
            unique.append(x)

    payload = {
        "schema": "DREAMLEDGER/777-SLIPSTREAM/v1",
        "generated_at": generated,
        "mode": "PUBLIC_RESEARCH_ONLY",
        "purpose": "Detect externally demonstrated mechanisms for qualification and Gauntlet review.",
        "truth": {
            "verified_external_revenue_nzd": 0,
            "settled_external_payments": 0,
            "independent_external_buyers": 0,
            "verified_economic_outcomes": 0,
        },
        "queries": QUERIES,
        "candidate_count": len(unique),
        "candidates": unique,
        "errors": errors,
        "next_step": "QUALIFY_AND_GAUNTLET",
        "prohibited": ["private_data", "credentials", "proprietary_code_copy", "outreach", "spending", "transaction_execution"],
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(json.dumps({"candidate_count": len(unique), "errors": len(errors), "output": OUT}))

if __name__ == "__main__":
    main()
