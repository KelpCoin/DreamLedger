#!/usr/bin/env python3
"""Public-source discovery and evidence-gated loop evolution. Stdlib only; no publishing or payments."""
from __future__ import annotations
import hashlib, json, os, re, sys, time, urllib.parse, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
ARCHIVE = DATA / "archive.jsonl"
REPORT = DATA / "latest-report.json"
PROVEN = DATA / "proven-components.json"
USER_AGENT = "DreamLedgerEconomicResearch/1.0 (public-source research; contact via repository)"
TIMEOUT = 12
MAX_BODY = 1800
FEEDS = [
    "https://www.reddit.com/r/smallbusiness/.rss",
    "https://www.reddit.com/r/Entrepreneur/.rss",
    "https://hnrss.org/newest?q=automation",
    "https://hnrss.org/newest?q=invoice",
    "https://hnrss.org/newest?q=API",
]

def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

def digest(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/atom+xml, application/rss+xml, application/xml, application/json"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        if r.status != 200: raise RuntimeError("HTTP " + str(r.status))
        return r.read(1_500_000)

def clean(s):
    return re.sub(r"\\s+", " ", re.sub(r"<[^>]+>", " ", s or "")).strip()[:MAX_BODY]

def parse_feed(raw, source):
    root = ET.fromstring(raw)
    rows = []
    for e in root.iter():
        tag = e.tag.rsplit("}", 1)[-1].lower()
        if tag not in ("item", "entry"): continue
        fields = {}
        for child in e:
            k = child.tag.rsplit("}", 1)[-1].lower()
            fields[k] = (child.text or "").strip()
            if k == "link" and child.attrib.get("href"): fields[k] = child.attrib["href"]
        url = fields.get("link") or fields.get("guid") or ""
        if not url.startswith(("https://", "http://")): continue
        title = clean(fields.get("title", ""))
        summary = clean(fields.get("description") or fields.get("summary") or fields.get("content", ""))
        text = (title + " " + summary).lower()
        terms = ["need", "looking for", "recommend", "manual", "spreadsheet", "automate", "invoice", "quote", "workflow", "pain", "expensive", "alternative", "api", "report", "time-consuming", "broken"]
        matched = [x for x in terms if x in text]
        rows.append({"source": source, "url": url, "title": title, "excerpt": summary, "published": fields.get("published") or fields.get("updated") or fields.get("pubdate") or "", "signal_terms": matched, "observed_at": now(), "content_hash": digest(url + "\n" + title + "\n" + summary)})
    return rows

def fetch_hn():
    q = urllib.parse.urlencode({"query": "automation OR invoice OR quote OR workflow OR API", "tags": "story", "hitsPerPage": "30"})
    raw = json.loads(get("https://hn.algolia.com/api/v1/search_by_date?" + q))
    out = []
    for h in raw.get("hits", []):
        url = h.get("url") or ("https://news.ycombinator.com/item?id=" + str(h.get("objectID", "")))
        title = clean(h.get("title", ""))
        excerpt = clean(h.get("story_text", ""))
        text = (title + " " + excerpt).lower()
        terms = ["need", "looking for", "recommend", "manual", "spreadsheet", "automate", "invoice", "quote", "workflow", "pain", "expensive", "alternative", "api", "report", "time-consuming", "broken"]
        out.append({"source": "hackernews_api", "url": url, "title": title, "excerpt": excerpt, "published": h.get("created_at", ""), "signal_terms": [x for x in terms if x in text], "observed_at": now(), "content_hash": digest(url + "\n" + title + "\n" + excerpt)})
    return out

def load_archive():
    rows, seen = [], set()
    if ARCHIVE.exists():
        for line in ARCHIVE.read_text(encoding="utf-8").splitlines():
            try: row = json.loads(line)
            except ValueError: continue
            key = row.get("id") or digest(row.get("url", ""))
            if key not in seen: rows.append(row); seen.add(key)
    return rows, seen

def load_proven():
    if not PROVEN.exists(): return []
    try: data = json.loads(PROVEN.read_text(encoding="utf-8"))
    except ValueError: return []
    return data if isinstance(data, list) else []

def eligible_component(c):
    return c.get("status") == "VERIFIED" and int(c.get("verified_external_outcomes", 0)) >= 1 and c.get("evidence_ref") and c.get("success_definition")

def make_marriages(proven):
    components = [c for c in proven if eligible_component(c)]
    proposals = []
    for i, a in enumerate(components):
        for b in components[i+1:]:
            if a.get("id") == b.get("id"): continue
            ids = sorted([str(a["id"]), str(b["id"])])
            proposals.append({"id": "MARRIAGE-" + digest("|".join(ids))[:12], "parents": ids,
              "status": "PROPOSAL_ONLY", "why_combine": "Requires an explicit, evidence-backed complementarity hypothesis.",
              "success_definition": {"primary": "independent external settled payment", "required": ["matched order", "fulfilled deliverable", "delivery evidence", "human verification"], "replication_rule": "do not clone until outcome is independently verified"},
              "resource_cap": {"max_runs": 3, "max_cost_nzd": 0, "max_children": 1}, "created_at": now()})
    return proposals

def run():
    DATA.mkdir(parents=True, exist_ok=True)
    old, seen = load_archive()
    fresh, errors = [], []
    for url in FEEDS:
        try: fresh.extend(parse_feed(get(url), url))
        except Exception as e: errors.append({"source": url, "error": type(e).__name__ + ": " + str(e)[:160]})
        time.sleep(0.3)
    try: fresh.extend(fetch_hn())
    except Exception as e: errors.append({"source": "hackernews_api", "error": type(e).__name__ + ": " + str(e)[:160]})
    added = []
    for row in fresh:
        row["id"] = digest(row["url"])
        if row["id"] not in seen:
            added.append(row); seen.add(row["id"])
    combined = old + added
    tmp = ARCHIVE.with_suffix(".jsonl.tmp")
    tmp.write_text("".join(json.dumps(r, ensure_ascii=True, sort_keys=True) + "\n" for r in combined), encoding="utf-8")
    tmp.replace(ARCHIVE)
    proven = load_proven()
    marriages = make_marriages(proven)
    # Rank research leads, not claims of demand. No automatic offers or external actions.
    ranked = sorted(combined, key=lambda r: (len(r.get("signal_terms", [])), bool(r.get("title"))), reverse=True)[:100]
    report = {"schema_version": 1, "generated_at": now(), "mode": "RESEARCH_ONLY_NO_EXTERNAL_ACTIONS",
      "sources_attempted": len(FEEDS) + 1, "source_errors": errors, "items_total": len(combined), "items_added_this_run": len(added),
      "research_leads": ranked, "verified_components_loaded": len([c for c in proven if eligible_component(c)]),
      "loop_marriage_proposals": marriages, "guardrails": ["discovery is not demand proof", "no payments or publishing", "no automatic cloning of unverified loops", "respect source terms and rate limits"]}
    REPORT.write_text(json.dumps(report, ensure_ascii=True, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("generated_at", "sources_attempted", "source_errors", "items_total", "items_added_this_run", "verified_components_loaded", "loop_marriage_proposals")}, indent=2))

if __name__ == "__main__":
    run()
