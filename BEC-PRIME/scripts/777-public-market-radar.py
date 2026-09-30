#!/usr/bin/env python3
import hashlib
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime, timezone

OUT = Path("BEC-PRIME/data/777/public-market-radar.json")
MAX_CANDIDATES = 1000
SUBREDDITS = ["EDH", "mtg", "Magicdeckbuilding"]
SIGNAL_QUERIES = [
    '"what should I cut"',
    '"what should I add"',
    '"what upgrades"',
    '"help me tune"',
    '"deck help"',
    '"deck advice"',
    '"help with my deck"',
    '"make this deck more consistent"',
    '"what cards should I cut"',
    '"what cards should I add"',
    '"need help upgrading"',
    '"stuck at" "cards"',
]

def fetch_reddit(subreddit, query):
    params = urllib.parse.urlencode({
        "q": query,
        "restrict_sr": "1",
        "sort": "new",
        "t": "month",
        "limit": "50",
    })
    url = f"https://www.reddit.com/r/{subreddit}/search.rss?{params}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "DreamLedger-777-Public-Signal-Radar/2.0"},
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()

def clean_text(value):
    return re.sub(r"\s+", " ", value or "").strip()

def main():
    generated = datetime.now(timezone.utc).isoformat()
    rows = []
    errors = []
    seen = set()

    for subreddit in SUBREDDITS:
        for query in SIGNAL_QUERIES:
            try:
                root = ET.fromstring(fetch_reddit(subreddit, query))
                for entry in root.findall("{http://www.w3.org/2005/Atom}entry"):
                    title = clean_text(entry.findtext("{http://www.w3.org/2005/Atom}title"))
                    link_node = entry.find("{http://www.w3.org/2005/Atom}link")
                    link = link_node.attrib.get("href", "").strip() if link_node is not None else ""
                    published = clean_text(entry.findtext("{http://www.w3.org/2005/Atom}published"))
                    updated = clean_text(entry.findtext("{http://www.w3.org/2005/Atom}updated"))
                    if not title or not link or link in seen:
                        continue
                    seen.add(link)
                    rows.append({
                        "candidate_id": "REDDIT-DECK-" + hashlib.sha256(link.encode("utf-8")).hexdigest()[:16].upper(),
                        "title": title,
                        "url": link,
                        "published": published,
                        "updated": updated,
                        "surface": f"reddit.com/r/{subreddit}",
                        "subreddit": subreddit,
                        "matched_signal": query,
                        "signal_type": "PUBLIC_DECK_TUNING_PROBLEM",
                        "problem_signal": "OBSERVED_PUBLIC_REQUEST_FOR_DECK_HELP",
                        "buyer_signal": "DEMONSTRATED_PROBLEM",
                        "permission_status": "UNKNOWN_REQUIRES_SURFACE_RULE_CHECK",
                        "commercial_fit": "DIRECT_TO_COMMANDER_DIAGNOSTIC",
                        "offer_id": "OFFER-CMD-DIAG-29-NZD",
                        "price_nzd": 29,
                        "external_action": "HUMAN_APPROVAL_REQUIRED",
                        "outreach_status": "NOT_CONTACTED",
                        "source_type": "PUBLIC_REDDIT_RSS",
                        "truth_status": "UNVERIFIED_DEMAND_SIGNAL",
                    })
                    if len(rows) >= MAX_CANDIDATES:
                        break
                if len(rows) >= MAX_CANDIDATES:
                    break
            except Exception as e:
                errors.append({
                    "subreddit": subreddit,
                    "query": query,
                    "error": str(e)[:300],
                })
        if len(rows) >= MAX_CANDIDATES:
            break

    rows.sort(key=lambda x: (x.get("published", ""), x.get("candidate_id", "")), reverse=True)
    rows = rows[:MAX_CANDIDATES]

    payload = {
        "schema_version": "DREAMLEDGER/777/PUBLIC-DECK-SIGNAL-RADAR/v2",
        "generated_at_utc": generated,
        "purpose": "surface public Commander deck-tuning problems for qualification and Gauntlet review; never contact, publish, spend, or claim revenue",
        "experimental_unit": "ONE_PUBLICLY_OBSERVED_DECK_TUNING_PROBLEM",
        "offer": {
            "offer_id": "OFFER-CMD-DIAG-29-NZD",
            "price_nzd": 29,
            "action": "EXISTING_CHECKOUT_ONLY",
        },
        "queries": SIGNAL_QUERIES,
        "subreddits": SUBREDDITS,
        "candidate_count": len(rows),
        "candidates": rows,
        "errors": errors,
        "truth_boundary": {
            "revenue_nzd": 0,
            "settled_external_payments": 0,
            "independent_external_buyers": 0,
            "verified_economic_outcomes": 0,
        },
        "external_action_gate": "HUMAN_APPROVAL_REQUIRED",
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "PASS",
        "signals": len(rows),
        "errors": len(errors),
        "output": str(OUT),
        "truth": payload["truth_boundary"],
    }))

if __name__ == "__main__":
    main()
