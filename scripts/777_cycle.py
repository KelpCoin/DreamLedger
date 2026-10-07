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

# 777 sensing order: buyer-adjacent procurement first, then Stats NZ economic releases.
# A failed source is never interpreted as zero demand.
# 777 sensing universe: private-sector commercial events only.
# Government, schools, hospitals, universities and public-sector procurement are
# explicitly excluded from the buyer universe. Google News RSS is a discovery
# transport; the linked publisher remains the source that must be corroborated.
PRIVATE_SEARCHES = [
    '"signed agreement" contract supplier financing -government -school -hospital -university -council -ministry -municipality',
    '"customer prepayment" OR "prepayment" contract cloud supplier -government -school -hospital -university',
    '"forward flow" OR "purchase agreement" financing "commercial" -government -school -hospital -university',
    '"milestone payment" agreement company contract -government -school -hospital -university',
    '"capacity reservation" OR "capacity commitment" company customer contract -government -school -hospital -university',
]
ROOT = Path("webapp")
PULSE = ROOT / "pulse"
INDEX = ROOT / "index.html"
PULSE.mkdir(parents=True, exist_ok=True)

QUOTE_CHECKOUT = os.environ.get(
    "QUOTE_COMPARE_CHECKOUT",
    "https://buy.stripe.com/14AdN97LD6pLfuLdVadwc32",
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
            "department of", "procurement notice", "tender notice", "rfq"
        ]
        if any(term in low for term in blocked):
            continue
        commercial_terms = [
            "agreement", "contract", "financing", "prepayment", "purchase",
            "supplier", "capacity", "funding", "milestone", "acquisition",
            "renewal", "facility", "commitment", "partnership"
        ]
        if not any(term in low for term in commercial_terms):
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
    source_url = google_news_url(query)
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
    signal = deduped[0]
    key_material = json.dumps(signal, sort_keys=True)
    key = hashlib.sha256(key_material.encode()).hexdigest()[:16]
    filename = f"{now.date().isoformat()}-private-commercial-{slug(signal['title'])}-{key}.html"
    target = PULSE / filename

    if not target.exists():
        title = html.escape(signal["title"])
        source_url = html.escape(signal["url"], quote=True)
        checkout = html.escape(QUOTE_CHECKOUT, quote=True)
        body = f"""<!doctype html>
<html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>777 Private Commercial Signal: {title}</title>
<meta name="robots" content="index,follow">
<meta name="description" content="Source-bound private-sector commercial signal observed through a public news discovery feed.">
</head><body><main>
<p><a href="/">DreamLedger</a> / 777 Private Commercial</p>
<h1>{title}</h1>
<p><strong>Observed:</strong> {now.isoformat()} · <strong>Publisher:</strong> {html.escape(signal["publisher"])}</p>
<section><h2>Primary observation</h2>
<ul>
<li>Publisher: {html.escape(signal["publisher"])}</li>
<li>Published: {html.escape(signal["published_at"])}</li>
<li>Discovery source: Google News RSS</li>
</ul>
<p><a href="{source_url}" rel="noopener noreferrer">Open the publisher source</a></p>
</section>
<section><h2>Commercial response surface</h2>
<p>This is a private-sector commercial signal, not proof of buyer intent. The linked publisher source must be corroborated before an economic action is considered. If the counterparty already has supplier quotations, the existing automated quote-comparison service can normalize 2–5 quotes into an evidence-backed decision packet.</p>
<p><a href="{checkout}">Open the existing NZ$49 Supplier Quote Comparison checkout</a></p>
</section>
<section><h2>Truth boundary</h2>
<p>Status: UNVERIFIED. No buyer, payment, fulfillment, or verified economic outcome is inferred from this observation.</p>
</section>
</main></body></html>"""
        target.write_text(body, encoding="utf-8")

    items = []
    for f in sorted(PULSE.glob("*-private-commercial-*.html"), reverse=True):
        text = f.read_text(encoding="utf-8", errors="ignore")
        m = re.search(r"<h1>(.*?)</h1>", text, re.S)
        t = re.sub("<[^>]+>", "", m.group(1)).strip() if m else f.stem
        items.append(f'<li><a href="pulse/{html.escape(f.name, quote=True)}">{html.escape(t)}</a></li>')

    existing_index = INDEX.read_text(encoding="utf-8", errors="ignore") if INDEX.exists() else ""
    section_start = "<h2>Latest private commercial pulses</h2>\n<ul>"
    start_index = existing_index.find(section_start)
    if start_index >= 0:
        list_end = existing_index.find("</ul>", start_index)
        if list_end >= 0:
            replacement = section_start + "\n".join(items[:100]) + "</ul>"
            INDEX.write_text(
                existing_index[:start_index] + replacement + existing_index[list_end + len("</ul>"):],
                encoding="utf-8",
            )
    else:
        print("INDEX_PRESERVED=private_commercial_section_not_present")

    print(f"PRIVATE_COMMERCIAL_SIGNAL={signal['title']}")
    print(f"PULSE={target}")
    print("TRUTH=UNVERIFIED")
    raise SystemExit(0)

raise SystemExit(
    "NO_PRIVATE_COMMERCIAL_SIGNAL: configured private-sector discovery feeds returned no admissible signal; "
    + ";".join(source_errors)
)
