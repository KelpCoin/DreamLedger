#!/usr/bin/env python3
import hashlib
import html
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime, timezone, timedelta

OUT = Path("BEC-PRIME/data/777/public-market-radar.json")
MAX_CANDIDATES = 15
SUBREDDITS = ["procurement", "civilengineering", "Construction"]
SIGNAL_QUERY = '"quote comparison" OR "quote leveling" OR "supplier quotes" OR "bid leveling" OR "compare quotes"'
ATOM = "{http://www.w3.org/2005/Atom}"

def fetch_reddit(subreddit, query):
    params = urllib.parse.urlencode({
        "q": query,
        "restrict_sr": "1",
        "sort": "new",
        "t": "year",
        "limit": "25",
    })
    url = f"https://www.reddit.com/r/{subreddit}/search.rss?{params}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "DreamLedgerEconomicEvidenceRadar/1.0 (public source discovery; no posting or outreach)"},
    )
    with urllib.request.urlopen(req, timeout=20) as response:
        return response.read()

def clean_text(value):
    value = html.unescape(value or "")
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = re.sub(r"</p\s*>", "\n", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"[ \t\r\f\v]+", " ", value).strip()

def author_hash(entry):
    name = clean_text(entry.findtext(f"{ATOM}author/{ATOM}name"))
    if not name:
        return None
    return hashlib.sha256(name.encode("utf-8")).hexdigest()

def first_person_candidate(text):
    has_first_person = bool(re.search(r"\b(i|we|my|our|me|us)\b", text or "", re.I))
    has_problem_context = bool(re.search(r"\b(manual|manually|spreadsheet|excel|pdf|hours|frustrat|pain|compare|quotes|scope|rework|messy)\b", text or "", re.I))
    return has_first_person and has_problem_context

def freshness(timestamp, now):
    if not timestamp:
        return "UNKNOWN"
    try:
        parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return "CURRENT_SOURCE" if parsed >= now - timedelta(days=90) else "STALE"
    except Exception:
        return "UNKNOWN"

def main():
    generated = datetime.now(timezone.utc)
    rows = []
    errors = []
    seen = set()

    # One bounded search per relevant community. Do not run a high-volume
    # keyword fan-out on every five-minute economic control cycle.
    for subreddit in SUBREDDITS:
        try:
            root = ET.fromstring(fetch_reddit(subreddit, SIGNAL_QUERY))
            for entry in root.findall(f"{ATOM}entry"):
                title = clean_text(entry.findtext(f"{ATOM}title"))
                link_node = entry.find(f"{ATOM}link")
                link = link_node.attrib.get("href", "").strip() if link_node is not None else ""
                published = clean_text(entry.findtext(f"{ATOM}published"))
                updated = clean_text(entry.findtext(f"{ATOM}updated"))
                excerpt = clean_text(entry.findtext(f"{ATOM}content"))
                if not title or not link or link in seen:
                    continue
                seen.add(link)
                quote = excerpt or None
                author_digest = author_hash(entry)
                complaint_candidate = first_person_candidate(quote or title)
                freshness_status = freshness(published, generated)
                evidence = {
                    "schema": "DREAMLEDGER/ECONOMIC-EVIDENCE-LADDER/v1",
                    "source_url": link,
                    "source_timestamp": published or None,
                    "exact_quote": quote,
                    "author_hash": author_digest,
                    "first_person_complaint": False,
                    "first_person_complaint_candidate": complaint_candidate,
                    "workaround_description": None,
                    "workaround_description_candidate": (
                        "Possible manual quote-normalization workaround; requires source review."
                        if re.search(r"\b(spreadsheet|excel|pdf|manually|manual|copy.?paste)\b", quote or title, re.I)
                        else None
                    ),
                    "economic_cost_type": None,
                    "economic_cost_amount": None,
                    "economic_cost_currency": None,
                    "economic_cost_period": None,
                    "current_spend_status": "NOT_ASSESSED",
                    "payment_intent_status": "NOT_OBSERVED",
                    "commercial_evidence_status": "NOT_ESTABLISHED",
                    "freshness_status": freshness_status,
                    "evidence_rung": 0,
                    "rung_name": "UNCLASSIFIED_INCOMPLETE_SOURCE",
                    "replication_eligible": False,
                    "promotion_rule": "Gauntlet/source review must verify first-person complaint and permission; radar output alone cannot promote a rung."
                }
                rows.append({
                    "candidate_id": "REDDIT-QUOTE-" + hashlib.sha256(link.encode("utf-8")).hexdigest()[:16].upper(),
                    "title": title,
                    "url": link,
                    "source_url": link,
                    "published": published,
                    "updated": updated,
                    "source_observed_at": published or None,
                    "surface": f"reddit.com/r/{subreddit}",
                    "subreddit": subreddit,
                    "author_hash": author_digest,
                    "exact_quote": quote,
                    "first_person_complaint": False,
                    "first_person_complaint_candidate": complaint_candidate,
                    "workaround_description_candidate": evidence["workaround_description_candidate"],
                    "signal_type": "QUOTE_NORMALIZATION_RESEARCH_CANDIDATE",
                    "problem_signal": "UNVERIFIED_PUBLIC_SOURCE_SIGNAL",
                    "buyer_signal": "UNVERIFIED_NOT_BUYING_INTENT",
                    "permission": "UNVERIFIED_SURFACE_RULES",
                    "permission_status": "UNKNOWN_REQUIRES_SURFACE_RULE_CHECK",
                    "commercial_fit": "QUOTE_NORMALIZATION",
                    "offer_id": "QUOTE-COMPARE-49",
                    "price_nzd": 49,
                    "external_action": "HUMAN_APPROVAL_REQUIRED",
                    "outreach_status": "NOT_CONTACTED",
                    "source_type": "PUBLIC_REDDIT_RSS",
                    "truth_status": "UNVERIFIED_DEMAND_SIGNAL",
                    "economic_evidence": evidence
                })
                if len(rows) >= MAX_CANDIDATES:
                    break
            if len(rows) >= MAX_CANDIDATES:
                break
        except Exception as error:
            errors.append({
                "subreddit": subreddit,
                "query": SIGNAL_QUERY,
                "error": str(error)[:300],
            })

    rows.sort(key=lambda row: (row.get("published") or "", row.get("candidate_id") or ""), reverse=True)
    rows = rows[:MAX_CANDIDATES]
    current_candidates = sum(1 for row in rows if row["economic_evidence"]["freshness_status"] == "CURRENT_SOURCE")
    candidate_complaints = sum(1 for row in rows if row["first_person_complaint_candidate"])
    status = "PASS" if rows and not errors else "DEGRADED_PARTIAL" if rows else "DEGRADED_NO_SOURCE_RESULTS"

    payload = {
        "schema_version": "DREAMLEDGER/777/PUBLIC-QUOTE-NORMALIZATION-RADAR/v1",
        "generated_at_utc": generated.isoformat(),
        "purpose": "find and preserve sourced public quote-normalization signals; never contact, publish, spend, or claim revenue",
        "experimental_unit": "ONE_PUBLICLY_OBSERVED_QUOTE_NORMALIZATION_SIGNAL",
        "offer": {
            "offer_id": "QUOTE-COMPARE-49",
            "price_nzd": 49,
            "status": "OFFER_HYPOTHESIS_ONLY",
            "checkout_and_fulfillment": "UNVERIFIED"
        },
        "query": SIGNAL_QUERY,
        "subreddits": SUBREDDITS,
        "candidate_count": len(rows),
        "current_source_count": current_candidates,
        "first_person_complaint_candidates_unverified": candidate_complaints,
        "candidates": rows,
        "errors": errors,
        "truth_boundary": {
            "verified_external_revenue_nzd": 0,
            "settled_external_payments": 0,
            "independent_external_buyers": 0,
            "verified_economic_outcomes": 0
        },
        "external_action_gate": "HUMAN_APPROVAL_REQUIRED",
        "promotion_rule": "Every radar record begins at rung 0. Exact source text, author hash, and timestamp are preserved when available; first-person complaint, workaround, economic cost, and permission require verification."
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": status,
        "signals": len(rows),
        "current_source_count": current_candidates,
        "first_person_complaint_candidates_unverified": candidate_complaints,
        "errors": len(errors),
        "output": str(OUT),
        "truth": payload["truth_boundary"]
    }))

if __name__ == "__main__":
    main()
