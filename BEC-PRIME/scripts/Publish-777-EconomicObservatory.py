#!/usr/bin/env python3
"""
777 Economic Observatory publisher.

This is a public-surface adapter around the existing 777/CUBE substrate.
It does not create a new ledger, queue, truth system, or commerce rail.

Each run:
  1. observes current public NZ economic sources,
  2. deduplicates them against the existing manifest,
  3. publishes at most one source-bound event page,
  4. updates the public observatory index, pulse JSON and sitemap,
  5. optionally records the observation in existing Supabase economic_events
     and economic_silo_registry tables when runtime credentials are present.

Public pages never assert buyer, payment, revenue, fulfillment, or verification
unless an authoritative source explicitly establishes that fact. The public
event page is an observation, not economic truth.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
EVENT_DIR = PUBLIC / "economic"
DATA_DIR = PUBLIC / "data"
MANIFEST = DATA_DIR / "economic-events-manifest.json"
PULSE = DATA_DIR / "economic-pulse.json"
SITEMAP_ROOT = ROOT / "sitemap.xml"
SITEMAP_PUBLIC = PUBLIC / "sitemap.xml"
ROBOTS_PUBLIC = PUBLIC / "robots.txt"

BASE = "https://dreamledger.org"
UA = "DreamLedger-777-Economic-Observatory/1.0 (+https://dreamledger.org)"
MAX_DISCOVERED = 80

GOOGLE_NEWS_QUERIES = [
    "New Zealand company hiring expansion jobs",
    "New Zealand manufacturing factory expansion investment",
    "New Zealand construction contract awarded project",
    "New Zealand council tender infrastructure",
    "New Zealand business investment funding",
    "New Zealand export investment manufacturing",
    "New Zealand infrastructure funding project",
    "New Zealand jobs hiring workforce expansion",
]

SOURCES = [
    ("GETS", "PROCUREMENT", "https://www.gets.govt.nz/ExternalIndex.htm", 100),
    ("BEEHIVE", "GOVERNMENT_INVESTMENT", "https://www.beehive.govt.nz/releases", 90),
    ("NZX", "MARKET_ANNOUNCEMENT", "https://www.nzx.com/markets/NZSX/announcements", 85),
]

KEYWORDS = {
    "PROCUREMENT": ["tender", "rfp", "rft", "rfq", "roi", "procurement", "contract opportunity"],
    "HIRING": ["hiring", "jobs", "recruit", "workforce", "employees", "staff"],
    "EXPANSION": ["expansion", "expand", "factory", "plant", "new facility", "capacity"],
    "INVESTMENT": ["investment", "invest", "funding", "million", "billion", "capital"],
    "INFRASTRUCTURE": ["infrastructure", "bridge", "road", "rail", "water", "hospital", "construction"],
    "MARKET": ["revenue", "profit", "guidance", "acquisition", "buyback", "results", "shares"],
}

def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

def get(url: str, timeout: int = 25) -> bytes:
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml,application/rss+xml,*/*",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def clean(value: str) -> str:
    value = html.unescape(value or "")
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", value).strip()

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self._href = None
        self._parts = []
    def handle_starttag(self, tag, attrs):
        if tag.lower() == "a":
            self._href = dict(attrs).get("href")
            self._parts = []
    def handle_data(self, data):
        if self._href is not None:
            self._parts.append(data)
    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.links.append((self._href, clean(" ".join(self._parts))))
            self._href = None
            self._parts = []

def absolute(base: str, href: str) -> str:
    return urllib.parse.urljoin(base, href)

def classify(title: str, source_type: str) -> str:
    text = title.lower()
    if source_type == "GETS":
        return "PROCUREMENT"
    for category, words in KEYWORDS.items():
        if any(w in text for w in words):
            return category
    return "ECONOMIC_SIGNAL"

def source_label(url: str) -> str:
    try:
        return urllib.parse.urlparse(url).netloc
    except Exception:
        return ""

def discover_listing(source_type: str, category: str, url: str):
    try:
        body = get(url).decode("utf-8", "ignore")
        parser = LinkParser()
        parser.feed(body)
        out = []
        seen = set()
        for href, title in parser.links:
            if not title or len(title) < 12:
                continue
            full = absolute(url, href)
            if full in seen:
                continue
            low = full.lower()
            if source_type == "GETS" and "gets.govt.nz" not in low:
                continue
            if source_type == "BEEHIVE" and "/releases/" not in low:
                continue
            if source_type == "NZX" and "nzx.com" not in low:
                continue
            if title.lower() in {"more", "next", "previous", "home"}:
                continue
            seen.add(full)
            out.append({
                "source_type": source_type,
                "category": classify(title, source_type),
                "title": title[:240],
                "url": full,
                "observed_at": now_iso(),
                "source_listing": url,
            })
            if len(out) >= MAX_DISCOVERED:
                break
        return out
    except Exception as exc:
        return [{
            "source_type": source_type,
            "category": category,
            "title": "SOURCE_ERROR",
            "url": url,
            "observed_at": now_iso(),
            "source_listing": url,
            "error": str(exc)[:300],
        }]

def discover_google_news(query: str):
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({
        "q": query + " when:1d",
        "hl": "en-NZ",
        "gl": "NZ",
        "ceid": "NZ:en",
    })
    out = []
    try:
        root = ET.fromstring(get(url))
        for item in root.findall("./channel/item")[:12]:
            title = clean(item.findtext("title") or "")
            link = clean(item.findtext("link") or "")
            pub = clean(item.findtext("pubDate") or "")
            if title and link:
                out.append({
                    "source_type": "GOOGLE_NEWS",
                    "category": classify(title, "GOOGLE_NEWS"),
                    "title": title[:240],
                    "url": link,
                    "observed_at": now_iso(),
                    "source_listing": url,
                    "published": pub,
                    "query": query,
                })
    except Exception as exc:
        out.append({
            "source_type": "GOOGLE_NEWS",
            "category": "ECONOMIC_SIGNAL",
            "title": "SOURCE_ERROR",
            "url": url,
            "observed_at": now_iso(),
            "source_listing": url,
            "error": str(exc)[:300],
        })
    return out

def stable_id(item: dict) -> str:
    raw = item["source_type"] + "|" + item["url"]
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def slugify(text: str) -> str:
    text = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return text[:90] or "economic-signal"

def load_json(path: Path, fallback):
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback

def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

def load_manifest():
    value = load_json(MANIFEST, {"schema": "DREAMLEDGER/777/ECONOMIC-EVENT-MANIFEST/v1", "events": []})
    if not isinstance(value.get("events"), list):
        value["events"] = []
    return value

def rank(item: dict) -> tuple:
    source_rank = {"GETS": 100, "BEEHIVE": 90, "NZX": 85, "GOOGLE_NEWS": 60}.get(item["source_type"], 10)
    category_rank = {"PROCUREMENT": 30, "INVESTMENT": 25, "EXPANSION": 25, "HIRING": 22, "INFRASTRUCTURE": 22, "MARKET": 20}.get(item["category"], 5)
    return (source_rank + category_rank, item.get("published", ""), item["title"])

def make_page(item: dict, event_id: str, related: list[dict]) -> str:
    title = html.escape(item["title"])
    category = html.escape(item["category"])
    source = html.escape(source_label(item["url"]))
    source_url = html.escape(item["url"], quote=True)
    observed = html.escape(item["observed_at"])
    links = "\n".join(
        f'<li><a href="/economic/{html.escape(x["slug"])}.html">{html.escape(x["title"])}</a></li>'
        for x in related[:5]
    )
    schema = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": item["title"],
        "datePublished": item.get("published") or item["observed_at"],
        "dateModified": item["observed_at"],
        "mainEntityOfPage": f"{BASE}/economic/{item['slug']}.html",
        "author": {"@type": "Organization", "name": "DreamLedger"},
        "publisher": {"@type": "Organization", "name": "DreamLedger"},
        "isAccessibleForFree": True,
    }
    return f"""<!doctype html>
<html lang="en-NZ">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow">
<link rel="canonical" href="{BASE}/economic/{html.escape(item['slug'])}.html">
<title>{title} | DreamLedger Economic Signal</title>
<meta name="description" content="Source-bound New Zealand economic signal: {title}">
<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>
<style>
body{{font-family:system-ui,-apple-system,sans-serif;max-width:820px;margin:0 auto;padding:32px 20px;color:#172018;line-height:1.6}}
a{{color:#155e3a}} .meta{{color:#66706a;font-size:14px}} .tag{{display:inline-block;border:1px solid #ccd6cf;border-radius:999px;padding:4px 10px;font-size:12px}}
.card{{border:1px solid #d9e0db;border-radius:14px;padding:20px;margin:24px 0;background:#fafcfb}}
.small{{font-size:13px;color:#66706a}}
</style>
</head>
<body>
<p><a href="/economic/">DreamLedger Economic Observatory</a></p>
<span class="tag">{category}</span>
<h1>{title}</h1>
<p class="meta">Observed {observed} · Source: {source}</p>
<div class="card">
<strong>What happened</strong>
<p>DreamLedger observed a publicly available economic signal with the title above. The source is preserved as the primary evidence link. This page records the observation; it does not upgrade the signal to verified economic truth.</p>
</div>
<div class="card">
<strong>Economic significance</strong>
<p>This signal is classified as <strong>{category}</strong>. It may indicate activity worth further CUBE analysis, but no buyer, payment, revenue, fulfillment, or commercial outcome is inferred from this observation alone.</p>
</div>
<div class="card">
<strong>Source evidence</strong>
<p><a href="{source_url}" rel="nofollow">Open the original source</a></p>
<p class="small">Source-bound publication. Verification status: UNVERIFIED. External action: NONE.</p>
</div>
<h2>Related signals</h2>
<ul>{links or "<li>No related signals published yet.</li>"}</ul>
</body>
</html>
"""

def build_observatory(events: list[dict]):
    rows = sorted(events, key=lambda x: x.get("observed_at", ""), reverse=True)[:200]
    cards = "\n".join(
        f'<article><span>{html.escape(x["category"])}</span><h2><a href="/economic/{html.escape(x["slug"])}.html">{html.escape(x["title"])}</a></h2><p>{html.escape(x["source_type"])} · {html.escape(x.get("published") or x["observed_at"])}</p></article>'
        for x in rows
    )
    return f"""<!doctype html>
<html lang="en-NZ">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow">
<link rel="canonical" href="{BASE}/economic/">
<title>New Zealand Economic Observatory | DreamLedger</title>
<meta name="description" content="Continuously updated, source-bound observations of New Zealand economic activity.">
<style>
body{{font-family:system-ui,-apple-system,sans-serif;max-width:1050px;margin:0 auto;padding:32px 20px;color:#172018;line-height:1.55}}
a{{color:#155e3a}} .lede{{color:#5f6a63;max-width:720px}} .grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px;margin-top:28px}}
article{{border:1px solid #d9e0db;border-radius:14px;padding:18px;background:#fafcfb}} article span{{font-size:11px;letter-spacing:.08em;font-weight:800;color:#68736c}} article h2{{font-size:19px;line-height:1.2;margin:8px 0}} article p{{font-size:13px;color:#68736c}}
</style>
</head>
<body>
<p><a href="/">DreamLedger</a></p>
<h1>New Zealand Economic Observatory</h1>
<p class="lede">A compounding public record of source-bound economic signals. New observations enter the existing 777/CUBE substrate; publication does not equal verification.</p>
<div class="grid">{cards or "<p>No observations published yet.</p>"}</div>
</body>
</html>
"""

def update_sitemaps(events: list[dict]):
    existing_urls = set()
    for path in (SITEMAP_ROOT, SITEMAP_PUBLIC):
        if path.exists():
            text = path.read_text(encoding="utf-8", errors="ignore")
            existing_urls.update(re.findall(r"<loc>(.*?)</loc>", text, flags=re.S))

    existing_urls.update([
        f"{BASE}/",
        f"{BASE}/economic/",
        f"{BASE}/truth-oracle.html",
        f"{BASE}/supplier-quote-comparison.html",
    ])
    existing_urls.update(
        f"{BASE}/economic/{x['slug']}.html"
        for x in events[:5000]
    )

    body = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]
    for url in sorted(existing_urls):
        body.append(f"  <url><loc>{html.escape(url)}</loc></url>")
    body.append("</urlset>")
    xml = "\n".join(body) + "\n"
    SITEMAP_ROOT.write_text(xml, encoding="utf-8")
    SITEMAP_PUBLIC.write_text(xml, encoding="utf-8")

    existing_robots = ROBOTS_PUBLIC.read_text(encoding="utf-8", errors="ignore") if ROBOTS_PUBLIC.exists() else ""
    if "Sitemap: https://dreamledger.org/sitemap.xml" not in existing_robots:
        existing_robots = existing_robots.rstrip() + "\nSitemap: https://dreamledger.org/sitemap.xml\n"
    ROBOTS_PUBLIC.write_text(existing_robots, encoding="utf-8")

def supabase_post(path: str, payload, key: str, on_conflict: str | None = None):
    base = "https://wbwgroygjeyukkspnqiy.supabase.co"
    url = base + "/rest/v1/" + path
    if on_conflict:
        url += "?on_conflict=" + urllib.parse.quote(on_conflict)
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST", headers={
        "apikey": key,
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status

def inject_supabase(item: dict, event_id: str, silo_id: str):
    key = __import__("os").environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        return "SKIPPED_NO_SUPABASE_KEY"
    try:
        evidence_ref = item["url"]
        event = {
            "event_id": event_id,
            "event_type": "PUBLIC_ECONOMIC_SIGNAL_OBSERVED",
            "state_before": "OBSERVED",
            "state_after": "OBSERVED",
            "authorization_state": "NOT_REQUIRED_INTERNAL_OBSERVATION",
            "settlement_state": "NOT_APPLICABLE",
            "fulfillment_state": "NOT_APPLICABLE",
            "verification_state": "UNVERIFIED",
            "source_system": "777-economic-observatory",
            "source_record_id": hashlib.sha256(evidence_ref.encode()).hexdigest(),
            "evidence_refs": [evidence_ref],
            "input_hash": hashlib.sha256(json.dumps(item, sort_keys=True).encode()).hexdigest(),
            "dependency_state": "OBSERVED_PUBLIC_SOURCE",
            "occurred_at": item["observed_at"],
            "recorded_at": now_iso(),
            "metadata": {
                "title": item["title"],
                "category": item["category"],
                "source_type": item["source_type"],
                "silo_id": silo_id,
                "truth_status": "UNVERIFIED",
                "external_action": "NONE",
            },
        }
        supabase_post("economic_events", event, key, "event_id")

        silo = {
            "silo_id": silo_id,
            "display_name": item["title"][:120],
            "slug": item["slug"],
            "source_signal_id": event_id,
            "domain_id": "NZ-ECONOMIC-OBSERVATORY",
            "template_key": "economic_signal",
            "market_region": "NZ",
            "buyer_problem": "UNVERIFIED_ECONOMIC_SIGNAL",
            "proposed_deliverable": "Source-bound public event record plus bounded internal CUBE probe",
            "lifecycle_stage": "CANDIDATE",
            "qualification_status": "UNQUALIFIED",
            "evidence_status": "UNVERIFIED",
            "public_visibility": "PUBLIC",
            "public_route": "/economic/" + item["slug"],
            "human_approval_required": True,
            "external_action_allowed": False,
            "origin": "DERIVED_FROM_OBSERVED_SIGNAL",
            "provenance": {
                "source_url": item["url"],
                "source_type": item["source_type"],
                "observed_at": item["observed_at"],
                "event_id": event_id,
                "truth_rule": "OBSERVATION_IS_NOT_VERIFICATION",
            },
        }
        supabase_post("economic_silo_registry", silo, key, "silo_id")
        return "INJECTED"
    except Exception as exc:
        return "DEGRADED:" + str(exc)[:220]

def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()
    existing = {x.get("source_key") for x in manifest["events"]}

    discovered = []
    for source_type, category, url, _weight in SOURCES:
        discovered.extend(discover_listing(source_type, category, url))
    for query in GOOGLE_NEWS_QUERIES:
        discovered.extend(discover_google_news(query))

    candidates = []
    for item in discovered:
        if item.get("title") == "SOURCE_ERROR":
            continue
        key = stable_id(item)
        if key in existing:
            continue
        item["source_key"] = key
        item["event_id"] = str(uuid.uuid5(uuid.NAMESPACE_URL, item["url"]))
        item["silo_id"] = "ECO-" + key[:16].upper()
        item["slug"] = (
            slugify(item["category"] + "-" + item["title"])[:72]
            + "-" + key[:10]
        )
        candidates.append(item)

    candidates.sort(key=rank, reverse=True)
    chosen = candidates[0] if candidates else None
    published = []

    if chosen:
        related = sorted(manifest["events"], key=lambda x: x.get("observed_at", ""), reverse=True)
        EVENT_DIR.mkdir(parents=True, exist_ok=True)
        page = make_page(chosen, chosen["event_id"], related)
        (EVENT_DIR / (chosen["slug"] + ".html")).write_text(page, encoding="utf-8")
        manifest["events"].insert(0, chosen)
        published.append(chosen)

    manifest["events"] = manifest["events"][:5000]

    pulse = load_json(PULSE, {
        "schema": "DREAMLEDGER/ECONOMIC-PULSE/v1",
        "status": "UNVERIFIED_SUBSTRATE_SNAPSHOT",
        "truth": {
            "verified_external_revenue_nzd": 0,
            "settled_external_payments": 0,
            "independent_external_buyers": 0,
            "verified_economic_outcomes": 0,
        },
        "signals": [],
        "cells": [],
        "verified_mechanisms": [],
        "commercial_surfaces": [],
    })
    if not chosen:
        print(json.dumps({
            "status": "PASS",
            "discovered": len(discovered),
            "new_candidates": len(candidates),
            "published_this_cycle": 0,
            "supabase": "NOT_ATTEMPTED",
            "manifest_count": len(manifest["events"]),
            "truth": pulse.get("truth", {}),
            "external_action": "NONE",
            "verification": "UNVERIFIED",
            "changed": False
        }, indent=2))
        return 0

    manifest["updated_at_utc"] = now_iso()
    write_json(MANIFEST, manifest)

    pulse["generated_at_utc"] = now_iso()
    pulse["status"] = "UNVERIFIED_SUBSTRATE_SNAPSHOT"
    pulse["truth"] = {
        "verified_external_revenue_nzd": 0,
        "settled_external_payments": 0,
        "independent_external_buyers": 0,
        "verified_economic_outcomes": 0,
    }
    pulse["signals"] = [{
        "id": x["event_id"],
        "type": "PUBLIC_ECONOMIC_SIGNAL",
        "title": x["title"],
        "status": "UNVERIFIED",
        "source": x["source_type"],
        "observed_at": x["observed_at"],
        "url": x["url"],
        "category": x["category"],
        "public_route": "/economic/" + x["slug"] + ".html",
    } for x in manifest["events"][:200]]
    write_json(PULSE, pulse)

    build_observatory(manifest["events"])
    (PUBLIC / "economic" / "index.html").write_text(
        build_observatory(manifest["events"]), encoding="utf-8"
    )
    update_sitemaps(manifest["events"])

    supabase_status = "NOT_ATTEMPTED"
    if chosen:
        supabase_status = inject_supabase(chosen, chosen["event_id"], chosen["silo_id"])

    result = {
        "status": "PASS",
        "discovered": len(discovered),
        "new_candidates": len(candidates),
        "published_this_cycle": len(published),
        "published_event": chosen["event_id"] if chosen else None,
        "published_url": f"{BASE}/economic/{chosen['slug']}.html" if chosen else None,
        "supabase": supabase_status,
        "manifest_count": len(manifest["events"]),
        "truth": pulse["truth"],
        "external_action": "NONE",
        "verification": "UNVERIFIED",
    }
    print(json.dumps(result, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
