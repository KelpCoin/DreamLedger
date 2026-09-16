import json
import os
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "ops" / "demand"

UA = "DreamLedger-IntentSentinel/1.0"
MAX_RESULTS = int(os.getenv("INTENT_MAX_RESULTS", "100"))

# These are opportunity classes, not claims that a buyer exists.
HYPOTHESES = [
    {"slug": "stripe-reconciliation", "name": "Stripe Production Reconciliation", "price_floor_nzd": 1500, "terms": ["stripe reconciliation", "stripe webhook duplicate", "stripe payment mismatch", "payment webhook missing"]},
    {"slug": "ai-saas-verification", "name": "AI SaaS Production Verification", "price_floor_nzd": 1500, "terms": ["ai generated saas production", "ai software production bug", "verify ai generated code", "ai app production issue"]},
    {"slug": "supabase-production-hardening", "name": "Supabase Production Hardening", "price_floor_nzd": 299, "terms": ["supabase rls production", "supabase security production", "supabase postgres problem", "supabase migration production"]},
    {"slug": "webhook-reliability", "name": "Webhook Reliability Rescue", "price_floor_nzd": 79, "terms": ["webhook idempotency", "webhook duplicate events", "webhook signature failure", "webhook ordering"]},
    {"slug": "payment-attribution", "name": "Payment Attribution Check", "price_floor_nzd": 149, "terms": ["stripe attribution", "checkout metadata", "payment attribution", "stripe conversion tracking"]},
    {"slug": "production-incident-pack", "name": "Production Incident Pack", "price_floor_nzd": 199, "terms": ["saas incident response", "production incident checklist", "production outage investigation", "postmortem help"]},
    {"slug": "commander-deck-diagnostic", "name": "Commander Deck Diagnostic", "price_floor_nzd": 29, "terms": ["commander deck help", "commander deck upgrade", "mtg deck diagnostic", "edh deck help"]},
    {"slug": "game-economy-audit", "name": "Game Economy Audit", "price_floor_nzd": 299, "terms": ["game economy balancing", "game economy inflation", "game currency sinks", "game economy audit"]},
]

# Stronger-than-interest language. A source gets intent points only when a
# concrete commercial verb, budget, hiring request, bounty, RFP, quote, or
# willingness-to-pay signal appears near the problem text.
INTENT_PATTERNS = [
    ("explicit_pay", re.compile(r"\\b(willing to pay|will pay|paying|paid|budget|bounty|cash reward|reward)\\b", re.I), 100),
    ("hire", re.compile(r"\\b(hire|hiring|looking to hire|contractor|freelancer|agency|vendor)\\b", re.I), 80),
    ("procurement", re.compile(r"\\b(rfp|rfq|request for proposal|request for quote|procurement|proposal|quote)\\b", re.I), 90),
    ("buy", re.compile(r"\\b(buy|purchase|pricing|price|cost|quote me|how much)\\b", re.I), 60),
    ("deadline", re.compile(r"\\b(deadline|asap|urgent|this week|need this month)\\b", re.I), 35),
    ("job", re.compile(r"\\b(job|role|gig|project|client)\\b", re.I), 35),
]


def get(url, headers=None, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8")


def github_search(query):
    token = os.getenv("GITHUB_TOKEN", "")
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    url = "https://api.github.com/search/issues?" + urllib.parse.urlencode({"q": query, "per_page": 20, "sort": "updated", "order": "desc"})
    try:
        data = json.loads(get(url, headers=headers))
        return data.get("items", [])
    except Exception as exc:
        return [{"error": str(exc)[:160], "source": "github"}]


def hn_search(query):
    url = "https://hn.algolia.com/api/v1/search?" + urllib.parse.urlencode({"query": query, "tags": "story", "hitsPerPage": 20})
    try:
        data = json.loads(get(url))
        return data.get("hits", [])
    except Exception as exc:
        return [{"error": str(exc)[:160], "source": "hackernews"}]


def score_text(text):
    points = 0
    matched = []
    for name, pattern, weight in INTENT_PATTERNS:
        if pattern.search(text):
            points += weight
            matched.append(name)
    # Multiple commercial indicators together are more useful than one generic
    # "interested" phrase, so add a bounded combination bonus.
    if len(matched) >= 2:
        points += min(100, (len(matched) - 1) * 25)
    return min(points, 400), matched


def relevance(text, terms):
    low = text.lower()
    hits = sum(1 for term in terms if term.lower() in low)
    return hits


def candidate_for(source, item, hypothesis):
    title = item.get("title") or item.get("name") or ""
    body = item.get("body") or item.get("story_text") or item.get("text") or ""
    text = (title + "\\n" + body).strip()
    rel = relevance(text, hypothesis["terms"])
    if not rel:
        return None
    intent, signals = score_text(text)
    if intent == 0:
        # Demand without commercial intent is retained only as weak context.
        intent = 5
    base = rel * 20 + intent
    if source == "github":
        url = item.get("html_url", "")
    elif source == "hackernews":
        url = item.get("url") or ("https://news.ycombinator.com/item?id=" + str(item.get("objectID", "")))
    else:
        url = ""
    return {
        "hypothesis": hypothesis["slug"],
        "hypothesis_name": hypothesis["name"],
        "source": source,
        "source_url": url,
        "title": title[:300],
        "intent_score": base,
        "intent_signals": signals,
        "relevance_terms": [t for t in hypothesis["terms"] if t.lower() in text.lower()],
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "price_floor_nzd": hypothesis["price_floor_nzd"],
    }


def main():
    observations = []
    errors = []
    for hypothesis in HYPOTHESES:
        for term in hypothesis["terms"]:
            for item in github_search(term):
                if item.get("error"):
                    errors.append(item)
                    continue
                c = candidate_for("github", item, hypothesis)
                if c:
                    observations.append(c)
            for item in hn_search(term):
                if item.get("error"):
                    errors.append(item)
                    continue
                c = candidate_for("hackernews", item, hypothesis)
                if c:
                    observations.append(c)

    # Deduplicate by source URL/title and keep the strongest signal.
    dedup = {}
    for item in observations:
        key = (item["source"], item["source_url"] or item["title"])
        if key not in dedup or item["intent_score"] > dedup[key]["intent_score"]:
            dedup[key] = item
    observations = sorted(dedup.values(), key=lambda x: x["intent_score"], reverse=True)[:MAX_RESULTS]

    # Aggregate only as a discovery aid. No aggregate is treated as revenue.
    by_hypothesis = {}
    for item in observations:
        bucket = by_hypothesis.setdefault(item["hypothesis"], {"name": item["hypothesis_name"], "observations": 0, "max_intent": 0, "explicit_pay_signals": 0})
        bucket["observations"] += 1
        bucket["max_intent"] = max(bucket["max_intent"], item["intent_score"])
        if "explicit_pay" in item["intent_signals"]:
            bucket["explicit_pay_signals"] += 1

    payload = {
        "schema_version": "intent-to-pay-sentinel.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_policy": "public_observation_only",
        "does_not_claim_revenue": True,
        "observations": observations,
        "hypothesis_summary": by_hypothesis,
        "errors": errors,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "intent_latest.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"observations": len(observations), "hypotheses": len(by_hypothesis), "errors": len(errors)}, indent=2))


if __name__ == "__main__":
    main()
