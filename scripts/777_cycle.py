from __future__ import annotations
import html
import hashlib
import json
import os
import re
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

# 777 sensing order: human/SMB/developer pain first. Follow the dollar, not prestige.
# A failed source is never interpreted as zero demand.
# Target universe: people, freelancers, creators, merchants, small businesses,
# startups, developers and machine/agent buyers with a concrete operational pain.
# Exclude public-sector demand and large-enterprise headline events unless the
# signal contains a directly usable human/API pain surface. Google News RSS is
# discovery transport; the linked publisher remains the source to corroborate.
PRIVATE_SEARCHES = [
    '"small business" invoice OR receipt OR quote OR document automation API -government -school -hospital -university -council -ministry',
    'freelancer OR creator payment OR invoice OR tax OR document API -government -school -hospital -university',
    'developer API integration OR webhook OR data extraction OR verification pain -government -school -hospital -university',
    'merchant OR ecommerce seller shipping OR returns OR product data OR pricing API -government -school -hospital -university',
    '"AI agent" API payment OR tool OR data OR verification OR automation -government -school -hospital -university',
]
ROOT = Path("webapp")
PULSE = ROOT / "pulse"
INDEX = ROOT / "index.html"
PULSE.mkdir(parents=True, exist_ok=True)

QUOTE_CHECKOUT = os.environ.get(
    "QUOTE_COMPARE_CHECKOUT",
    "https://buy.stripe.com/bJe7sL7LD4hDeqH04kdwc3e",
)

class ProcurementParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.in_tr = False
        self.in_cell = False
        self.cells = []
        self.buf = []
        self.links = []
        self.href = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "tr":
            self.in_tr = True
            self.cells = []
            self.links = []
        elif self.in_tr and tag in ("td", "th"):
            self.in_cell = True
            self.buf = []
        elif self.in_cell and tag == "a":
            self.href = attrs.get("href", "")

    def handle_data(self, data):
        if self.in_cell:
            self.buf.append(data)

    def handle_endtag(self, tag):
        if self.in_cell and tag in ("td", "th"):
            value = re.sub(r"\s+", " ", "".join(self.buf)).strip()
            self.cells.append(value)
            if self.href:
                self.links.append(self.href)
            self.in_cell = False
            self.buf = []
            self.href = None
        elif self.in_tr and tag == "tr":
            if self.cells:
                self.rows.append((self.cells[:], self.links[:]))
            self.in_tr = False

class StatsLinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.href = None
        self.buf = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            d = dict(attrs)
            href = d.get("href", "")
            if href.startswith("/") and any(
                x in href for x in ("information-releases", "publications", "insights", "news")
            ):
                self.href = href
                self.buf = []

    def handle_data(self, data):
        if self.href:
            self.buf.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.href:
            title = re.sub(r"\s+", " ", "".join(self.buf)).strip()
            if title:
                self.links.append((self.href, title))
            self.href = None
            self.buf = []

def fetch(source):
    req = urllib.request.Request(
        source,
        headers={
            "User-Agent": "DreamLedger-777/2.0 (+https://dreamledger.org)",
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def google_news_url(query):
    q = urllib.parse.quote(query)
    return "https://news.google.com/rss/search?q=" + q + "&hl=en-US&gl=US&ceid=US:en"


def parse_private_rss(raw):
    now = datetime.now(timezone.utc)
    try:
        root = ET.fromstring(raw)
    except Exception:
        return []
    rows = []
    for item in root.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub = (item.findtext("pubDate") or "").strip()
        source = item.findtext("source")
        source = (source or "").strip()
        if not title or not link:
            continue
        low = title.lower()
        blocked = [
            "government", "ministry", "council", "municipal", "city of ",
            "school", "schools", "university", "universities", "hospital",
            "health system", "public health", "state agency", "federal agency",
            "department of", "procurement notice", "tender notice", "rfq",
            "solar plant", "power plant", "infrastructure project",
            "acquisition", "merger", "partnership", "funding round",
            "financing facility", "enterprise-wide", "multibillion",
            "billion-dollar", "billion dollar"
        ]
        if any(term in low for term in blocked):
            continue
        pain_terms = [
            "api", "automation", "invoice", "receipt", "quote", "pricing",
            "payment", "shipping", "returns", "document", "pdf", "ocr",
            "extract", "verify", "verification", "webhook", "integration",
            "data", "csv", "developer", "freelancer", "creator", "merchant",
            "seller", "small business", "startup", "agent"
        ]
        if not any(term in low for term in pain_terms):
            continue
        try:
            published = datetime.strptime(pub, "%a, %d %b %Y %H:%M:%S %Z").replace(tzinfo=timezone.utc)
        except Exception:
            published = None
        if published is not None and (now - published).total_seconds() > 7 * 86400:
            continue
        rows.append({
            "source": "PRIVATE_SECTOR_RSS",
            "title": title,
            "url": link,
            "published_at": pub,
            "publisher": source or "UNKNOWN_PUBLISHER",
            "value_status": "UNKNOWN",
            "qualified_offer": "QUOTE-COMPARE-49",
            "truth_status": "UNVERIFIED"
        })
    return rows

def absolute(href):
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return "https://www.gets.govt.nz" + href
    return "https://www.gets.govt.nz/ExternalIndex.htm"

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:100]

def parse_gets(raw):
    p = ProcurementParser()
    p.feed(raw)
    out = []
    for cells, links in p.rows:
        if len(cells) < 6:
            continue
        # Current GETS public table order:
        # RFx ID | Reference # | Title | Tender Type | Close Date | Organisation
        rfx_id, reference, title, tender_type, close_date, organisation = cells[:6]
        if not title or title.lower() in {"title", "current tenders"}:
            continue
        if not re.search(r"\d", rfx_id):
            continue
        out.append({
            "source": "GETS",
            "rfx_id": rfx_id,
            "reference": reference,
            "title": title,
            "tender_type": tender_type,
            "close_date": close_date,
            "organisation": organisation,
            "url": absolute(links[0]) if links else "https://www.gets.govt.nz/ExternalIndex.htm",
            "value_status": "VALUE_UNKNOWN",
            "value_band": None,
            "qualified_offer": "QUOTE-COMPARE-49",
        })
    return out

def parse_stats(raw):
    p = StatsLinkParser()
    p.feed(raw)
    return [
        {"source": "STATS_NZ", "title": title, "url": "https://www.stats.govt.nz" + href}
        for href, title in p.links
    ]

now = datetime.now(timezone.utc)
signals = []
source_errors = []

for query in PRIVATE_SEARCHES:
    source_url = google_news_url(query + " when:7d")
    try:
        signals.extend(parse_private_rss(fetch(source_url)))
    except Exception as exc:
        source_errors.append(f"PRIVATE_RSS:{type(exc).__name__}")

# Stable de-duplication, then prefer the newest discovery with a named publisher.
seen = set()
deduped = []
for signal in signals:
    key = (signal["title"].lower(), signal["url"])
    if key in seen:
        continue
    seen.add(key)
    deduped.append(signal)

if "--local" in os.sys.argv:
    # Local mode is a sensor/qualification input only. It never writes the public site.
    print(json.dumps({"schema":"DREAMLEDGER/777/PRIVATE-SIGNAL-BATCH/v1","generated_at":now.isoformat(),"signals":deduped[:50],"source_errors":source_errors}, ensure_ascii=False))
    raise SystemExit(0)

if deduped:
    existing_titles = set()
    existing_urls = set()
    # Cross-artifact dedupe: observatory and other pulse pages count too, not only prior private-commercial cards.
    def decode_html(value):
        return (value.replace("&amp;", "&").replace("&quot;", '"')
                     .replace("&#39;", "'").replace("&#x27;", "'")
                     .replace("&lt;", "<").replace("&gt;", ">")
                     .replace("&nbsp;", " "))

    for existing in PULSE.glob("*.html"):
        try:
            text = existing.read_text(encoding="utf-8", errors="ignore")
            m = re.search(r"<h1>(.*?)</h1>", text, re.S)
            if m:
                title = decode_html(re.sub(r"<[^>]+>", "", m.group(1)))
                existing_titles.add(re.sub(r"\\s+", " ", title).strip().lower())
            for href in re.findall(r'href="(https?://[^"]+)"', text):
                existing_urls.add(decode_html(href).strip())
        except Exception:
            continue

    def candidate_key(item):
        title = item["title"].lower()
        freshness = 0
        try:
            freshness = datetime.strptime(item["published_at"], "%a, %d %b %Y %H:%M:%S %Z").timestamp()
        except Exception:
            pass
        pain = sum(
            term in title
            for term in ("api", "automation", "invoice", "receipt", "quote", "pricing",
                         "payment", "shipping", "returns", "document", "extract",
                         "verify", "webhook", "integration", "developer", "freelancer",
                         "creator", "merchant", "seller", "small business", "startup", "agent")
        )
        return (pain, freshness)

    fresh = [
        item for item in deduped
        if item["title"].lower() not in existing_titles and item["url"] not in existing_urls
    ]
    def update_index():
        if update_index():
        print("INDEX_UPDATED_WITH_LATEST_PRIVATE_COMMERCIAL_ARTIFACTS")
    else:
        print("INDEX_UNCHANGED")

    print(f"PRIVATE_COMMERCIAL_SIGNAL={signal['title']}")
    print(f"PULSE={target}")
    print("TRUTH=UNVERIFIED")
    raise SystemExit(0)

raise SystemExit(
    "NO_PRIVATE_COMMERCIAL_SIGNAL: configured private-sector discovery feeds returned no admissible signal; "
    + ";".join(source_errors)
)
