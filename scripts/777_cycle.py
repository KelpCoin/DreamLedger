from __future__ import annotations
import html
import hashlib
import json
import os
import re
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

# 777 sensing order: buyer-adjacent procurement first, then Stats NZ economic releases.
# A failed source is never interpreted as zero demand.
SOURCE_CANDIDATES = [
    ("GETS", "https://www.gets.govt.nz/ExternalIndex.htm"),
    ("STATS_NZ", "https://www.stats.govt.nz/information-releases/"),
    ("STATS_NZ", "https://www.stats.govt.nz/publications/"),
    ("STATS_NZ", "https://www.stats.govt.nz/insights/"),
    ("STATS_NZ", "https://www.stats.govt.nz/"),
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
            self.in_cell = False
            self.buf = []
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
            "url": "https://www.gets.govt.nz/ExternalIndex.htm",
        })
    return out

def parse_stats(raw):
    p = StatsLinkParser()
    p.feed(raw)
    return [
        {"source": "STATS_NZ", "title": title, "url": "https://www.stats.govt.nz" + href}
        for href, title in p.links
    ]

procurement = []
fallback_stats = []
source_errors = []

for source_name, source_url in SOURCE_CANDIDATES:
    try:
        raw = fetch(source_url)
        if source_name == "GETS":
            procurement.extend(parse_gets(raw))
            if procurement:
                break
        else:
            fallback_stats.extend(parse_stats(raw))
            if fallback_stats:
                break
    except Exception as exc:
        source_errors.append(f"{source_name}:{source_url}:{type(exc).__name__}")

now = datetime.now(timezone.utc)
if procurement:
    signal = procurement[0]
    key_material = json.dumps(signal, sort_keys=True)
    key = hashlib.sha256(key_material.encode()).hexdigest()[:16]
    filename = f"{now.date().isoformat()}-procurement-{slug(signal['title'])}-{key}.html"
    target = PULSE / filename

    if not target.exists():
        title = html.escape(signal["title"])
        source_url = html.escape(signal["url"], quote=True)
        checkout = html.escape(QUOTE_CHECKOUT, quote=True)
        body = f"""<!doctype html>
<html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>777 Procurement Signal: {title}</title>
<meta name="robots" content="index,follow">
<meta name="description" content="Source-bound procurement signal observed through New Zealand GETS.">
</head><body><main>
<p><a href="/">DreamLedger</a> / 777 Procurement</p>
<h1>{title}</h1>
<p><strong>Observed:</strong> {now.isoformat()} · <strong>Source:</strong> GETS</p>
<section><h2>Primary observation</h2>
<ul>
<li>RFx ID: {html.escape(signal["rfx_id"])}</li>
<li>Reference: {html.escape(signal["reference"])}</li>
<li>Tender type: {html.escape(signal["tender_type"])}</li>
<li>Close date: {html.escape(signal["close_date"])}</li>
<li>Organisation: {html.escape(signal["organisation"])}</li>
</ul>
<p><a href="{source_url}" rel="noopener noreferrer">Open the primary GETS surface</a></p>
</section>
<section><h2>Commercial response surface</h2>
<p>This observation identifies procurement activity. It does not establish contract value, buyer intent, award probability, or revenue. If you are preparing a bid and already have supplier quotations, the existing automated quote-comparison service can normalize 2–5 quotes into an evidence-backed decision packet.</p>
<p><a href="{checkout}">Open the NZ$49 Supplier Quote Comparison checkout</a></p>
</section>
<section><h2>Truth boundary</h2>
<p>Status: UNVERIFIED. No buyer, payment, fulfillment, or verified economic outcome is inferred from this page.</p>
</section>
</main></body></html>"""
        target.write_text(body, encoding="utf-8")

    # Deterministic index of generated procurement pulses.
    items = []
    for f in sorted(PULSE.glob("*-procurement-*.html"), reverse=True):
        text = f.read_text(encoding="utf-8", errors="ignore")
        m = re.search(r"<h1>(.*?)</h1>", text, re.S)
        t = re.sub("<[^>]+>", "", m.group(1)).strip() if m else f.stem
        items.append(f'<li><a href="pulse/{html.escape(f.name, quote=True)}">{html.escape(t)}</a></li>')
    INDEX.write_text(
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>DreamLedger 777</title></head><body><main><h1>DreamLedger 777</h1><p>WORLD → PROCUREMENT SIGNAL → ATTRIBUTABLE ARTIFACT → RESPONSE SURFACE → MEASURABLE OUTCOME.</p><h2>Latest procurement pulses</h2><ul>"
        + "\n".join(items[:100])
        + "</ul></main></body></html>",
        encoding="utf-8",
    )
    print(f"PROCUREMENT_SIGNAL={signal['rfx_id']}|{signal['title']}")
    print(f"PULSE={target}")
    print("TRUTH=UNVERIFIED")
    raise SystemExit(0)

if fallback_stats:
    signal = fallback_stats[0]
    key = hashlib.sha256((signal["url"] + "|" + signal["title"]).encode()).hexdigest()[:16]
    filename = f"{now.date().isoformat()}-stats-{slug(signal['title'])}-{key}.html"
    target = PULSE / filename
    if not target.exists():
        target.write_text(
            f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>777 Economic Pulse: {html.escape(signal["title"])}</title></head><body><main><p><a href="/">DreamLedger</a></p><h1>{html.escape(signal["title"])}</h1><p>Observed {now.isoformat()} · Source: <a href="{html.escape(signal["url"], quote=True)}">Stats NZ</a></p><p>UNVERIFIED external economic signal. No buyer, payment, fulfillment, or revenue is inferred.</p></main></body></html>""",
            encoding="utf-8",
        )
    print(f"STATS_SIGNAL={signal['title']}")
    print("TRUTH=UNVERIFIED")
    raise SystemExit(0)

raise SystemExit(
    "NO_ATTRIBUTABLE_ECONOMIC_SIGNAL: all configured source surfaces unavailable or unparsable; "
    + ";".join(source_errors)
)
