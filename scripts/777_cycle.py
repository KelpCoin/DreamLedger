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
PULSE_INDEX = PULSE / "index.html"
PUBLIC_PULSE = Path("public") / "pulse"
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
    existing_documents = []
    # Cross-artifact dedupe includes editorially enriched pages whose headline differs from the discovery-feed title.
    stopwords = {
        "about", "after", "agent", "agents", "and", "announces", "announced", "api",
        "connecting", "from", "how", "into", "launch", "launches", "more", "new",
        "platform", "says", "the", "their", "this", "today", "with", "your"
    }

    def title_tokens(value):
        return {
            token for token in re.findall(r"[a-z0-9]{4,}", html.unescape(value).lower())
            if token not in stopwords
        }

    for existing in PULSE.glob("*.html"):
        try:
            document = existing.read_text(encoding="utf-8", errors="ignore")
            m = re.search(r"<h1>(.*?)</h1>", document, re.S)
            existing_title = html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip().lower() if m else ""
            if existing_title:
                existing_titles.add(existing_title)
            for href in re.findall(r'href="(https?://[^"]+)"', document):
                existing_urls.add(href)
            searchable = html.unescape(re.sub(r"<[^>]+>", " ", document)).lower()
            existing_documents.append((existing_title, title_tokens(searchable)))
        except Exception:
            continue

    def is_duplicate_signal(item):
        title = html.unescape(item["title"]).strip().lower()
        if title in existing_titles or item["url"] in existing_urls:
            return True
        candidate_tokens = title_tokens(title)
        if not candidate_tokens:
            return False
        for existing_title, document_tokens in existing_documents:
            overlap = candidate_tokens & document_tokens
            # Catch a repeated event when a prior artifact has an editorial headline and cites the primary source.
            if len(overlap) >= 4:
                return True
            title_overlap = candidate_tokens & title_tokens(existing_title)
            if len(title_overlap) >= 2 and len(overlap) >= 3:
                return True
        return False

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

    fresh = [item for item in deduped if not is_duplicate_signal(item)]
    if not fresh:
        # No-new-signal is not an engine failure. Return a useful, provenance-bound
        # fallback component from the existing Agent Bridge catalogue instead.
        catalog_path = Path("agent-bridge-catalog.json")
        try:
            catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
            services = catalog.get("services", [])
        except Exception as exc:
            raise SystemExit(f"NO_NEW_PRIVATE_COMMERCIAL_SIGNAL_AND_NO_CATALOG_FALLBACK: {type(exc).__name__}")
        if not services:
            raise SystemExit("NO_NEW_PRIVATE_COMMERCIAL_SIGNAL_AND_EMPTY_CATALOG")
        fingerprint = hashlib.sha256(json.dumps(services, sort_keys=True).encode()).hexdigest()[:12]
        fallback = PULSE / f"agent-bridge-capability-map-{fingerprint}.html"
        public_fallback = PUBLIC_PULSE / fallback.name
        public_index = PUBLIC_PULSE / "index.html"
        index_link = '<li><a href="/pulse/' + fallback.name + '">Agent Bridge capability map (catalogue candidates; settlement unverified)</a></li>'
        if fallback.exists():
            # The source-side artifact may exist before the public Pages tree contains it.
            # Promote that same component into the actual deployment root once, without duplicating it.
            if not public_fallback.exists():
                PUBLIC_PULSE.mkdir(parents=True, exist_ok=True)
                public_fallback.write_text(fallback.read_text(encoding="utf-8"), encoding="utf-8")
                if public_index.exists():
                    public_index_text = public_index.read_text(encoding="utf-8", errors="ignore")
                    if fallback.name not in public_index_text:
                        if "</ul>" in public_index_text:
                            public_index_text = public_index_text.replace("</ul>", index_link + "</ul>", 1)
                        else:
                            public_index_text = public_index_text.replace("</main>", "<ul>" + index_link + "</ul></main>", 1)
                        public_index.write_text(public_index_text, encoding="utf-8")
                print("777_FALLBACK_PUBLIC_COPY=" + public_fallback.as_posix())
            else:
                print("NO_NEW_PRIVATE_COMMERCIAL_SIGNAL: fallback already exists in the public tree; no duplicate published.")
                raise SystemExit(0)
            raise SystemExit(0)
        rows = []
        for service in sorted(services, key=lambda item: (float(item.get("price_nzd") or 0), item.get("id", ""))):
            rows.append(
                "<tr><td><code>{}</code></td><td>{}</td><td>NZD {:.2f} candidate price</td>"
                "<td><code>{}</code></td><td>{}</td></tr>".format(
                    html.escape(str(service.get("id", "UNKNOWN"))),
                    html.escape(str(service.get("description", "No description supplied"))),
                    float(service.get("price_nzd") or 0),
                    html.escape(str(service.get("route", "not specified"))),
                    "configured" if service.get("checkout_configured") else "not configured"
                )
            )
        fallback.write_text(
            "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
            "<meta name='viewport' content='width=device-width,initial-scale=1'>"
            "<title>DreamLedger Agent Bridge Capability Map</title>"
            "<meta name='description' content='A transparent, source-linked inventory of Agent Bridge service candidates and their verification state.'>"
            "<link rel='canonical' href='https://dreamledger.org/pulse/" + fallback.name + "'>"
            "<style>body{max-width:1100px;margin:32px auto;padding:0 20px;font:16px/1.6 system-ui}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;border-bottom:1px solid #8885;padding:9px;vertical-align:top}code{overflow-wrap:anywhere}.notice{padding:14px;border:1px solid #8888;border-radius:10px}</style>"
            "</head><body><main><p><a href='/'>DreamLedger</a> / <a href='/pulse/'>777 Observatory</a></p>"
            "<h1>Agent Bridge capability map</h1>"
            "<p>This component was generated by the 777 fallback because the current discovery batch contained no admissible new private-sector signal. It turns the existing catalogue into a reviewable integration map.</p>"
            "<div class='notice'><strong>Important verification boundary:</strong> catalogue entries are candidates, not proof that routes are reachable, that a payment settles, or that fulfillment works. All rows must be independently tested before being represented as live products. Candidate prices are not a quote or a promise of availability.</div>"
            "<p>Catalogue schema: " + html.escape(str(catalog.get("schema", "unknown"))) +
            " · Listed services: " + str(len(services)) +
            " · Catalogue manifest status: " + html.escape(str(catalog.get("manifest_status", "unknown"))) + "</p>"
            "<table><thead><tr><th>Service ID</th><th>Purpose</th><th>Candidate price</th><th>Route</th><th>Checkout config</th></tr></thead><tbody>"
            + "".join(rows) + "</tbody></table>"
            "<h2>Commercial acceptance gate</h2><ol><li>Probe the route with a harmless, bounded request.</li>"
            "<li>Verify the exact product, currency, and amount at checkout.</li>"
            "<li>Observe a real independent settled payment with matching metadata.</li>"
            "<li>Prove idempotent fulfillment and deliver the promised output.</li>"
            "<li>Attach the evidence receipt to the service record before changing its status.</li></ol>"
            "<p>Current catalogue data marks settlement and fulfillment unverified. This page therefore makes no revenue claim.</p>"
            "<p>Source: <a href='https://github.com/KelpCoin/DreamLedger/blob/main/agent-bridge-catalog.json'>DreamLedger Agent Bridge catalogue</a>.</p>"
            "</main></body></html>\n",
            encoding="utf-8"
        )
        pulse_index = PULSE / "index.html"
        index_link = '<li><a href="/pulse/' + fallback.name + '">Agent Bridge capability map (catalogue candidates; settlement unverified)</a></li>'
        if pulse_index.exists():
            index_text = pulse_index.read_text(encoding="utf-8", errors="ignore")
            if fallback.name not in index_text:
                if "</ul>" in index_text:
                    index_text = index_text.replace("</ul>", index_link + "</ul>", 1)
                else:
                    index_text = index_text.replace("</main>", "<ul>" + index_link + "</ul></main>", 1)
                pulse_index.write_text(index_text, encoding="utf-8")
        else:
            pulse_index.write_text(
                "<!doctype html><html lang='en'><head><meta charset='utf-8'><title>777 Observatory</title></head>"
                "<body><main><h1>777 Observatory</h1><p>Evidence-bound artifacts. Published components are not proof of revenue.</p><ul>"
                + index_link + "</ul></main></body></html>\n", encoding="utf-8"
            )
        print("777_FALLBACK_ARTIFACT=" + fallback.as_posix())
        print("777_FALLBACK_SERVICES=" + str(len(services)))
        print("TRUTH=UNVERIFIED")
        raise SystemExit(0)
    signal = max(fresh, key=candidate_key)
    key_material = json.dumps(signal, sort_keys=True)
    key = hashlib.sha256(key_material.encode()).hexdigest()[:16]
    filename = f"{now.date().isoformat()}-private-commercial-{slug(signal['title'])}-{key}.html"
    target = PULSE / filename

    if not target.exists():
        title = html.escape(signal["title"])
        source_url = html.escape(signal["url"], quote=True)
        body = f"""<!doctype html>
<html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>777 Private Commercial Signal: {title}</title>
<meta name="robots" content="noindex,follow">
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
<p><a href="https://dreamledger.org/quote-comparison/">Use the free quote-comparison input for Truth Oracle</a>. Quote submissions are observations, not verified market prices or transactions. Raw files and supplier identities remain private unless the user explicitly authorizes disclosure.</p>
<p><strong>Machine route:</strong> <a href="https://dreamledger-silo-gateway.onrender.com/api/toll/v1/manifest">Inspect the Agent/API toll manifest</a>. This link does not imply route availability, a price, entitlement, or successful settlement.</p>
</section>
<section><h2>Truth boundary</h2>
<p>Status: UNVERIFIED. No buyer, payment, fulfillment, or verified economic outcome is inferred from this observation.</p>
</section>
</main></body></html>"""
        target.write_text(body, encoding="utf-8")

    # Mirror the one freshly qualified artifact into the actual deployed storefront root.
    # Keep the curated public index intact and insert a link idempotently.
    PUBLIC_PULSE.mkdir(parents=True, exist_ok=True)
    public_target = PUBLIC_PULSE / filename
    if not public_target.exists():
        public_target.write_text(target.read_text(encoding="utf-8"), encoding="utf-8")

    public_index = PUBLIC_PULSE / "index.html"
    if public_index.exists():
        public_index_text = public_index.read_text(encoding="utf-8", errors="ignore")
    else:
        public_index_text = (
            '<!doctype html><html lang="en-NZ"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>777 Economic Observatory | DreamLedger</title></head><body><main>'
            '<h1>777 Economic Observatory</h1></main></body></html>'
        )
    public_href = f"/pulse/{html.escape(filename, quote=True)}"
    if public_href not in public_index_text:
        public_article = (
            f'<article><h2><a href="{public_href}">{html.escape(signal["title"])}</a></h2>'
            f'<p><strong>Observed:</strong> {now.date().isoformat()}. '
            '<strong>Truth:</strong> UNVERIFIED market signal. '
            'Source-discovery candidate, not proof of buyer intent, payment, fulfillment, or revenue.</p></article>\n'
        )
        revenue_marker = '<p><strong>Revenue truth:</strong>'
        if revenue_marker in public_index_text:
            public_index_text = public_index_text.replace(revenue_marker, public_article + revenue_marker, 1)
        elif "</main>" in public_index_text:
            public_index_text = public_index_text.replace("</main>", public_article + "</main>", 1)
        else:
            public_index_text += public_article
        public_index.write_text(public_index_text, encoding="utf-8")

    items = []
    for f in sorted(PULSE.glob("*-private-commercial-*.html"), reverse=True):
        text = f.read_text(encoding="utf-8", errors="ignore")
        m = re.search(r"<h1>(.*?)</h1>", text, re.S)
        t = re.sub("<[^>]+>", "", m.group(1)).strip() if m else f.stem
        items.append(f'<li><a href="pulse/{html.escape(f.name, quote=True)}">{html.escape(t)}</a></li>')

    # Publish a stable, discoverable research index instead of assuming the homepage has a private-pulse section.
    index_items = []
    for artifact in sorted(PULSE.glob("*.html"), key=lambda p: p.name, reverse=True):
        if artifact.name == "index.html":
            continue
        try:
            artifact_text = artifact.read_text(encoding="utf-8", errors="ignore")
            heading = re.search(r"<h1>(.*?)</h1>", artifact_text, re.S)
            if not heading:
                continue
            artifact_title = html.unescape(re.sub(r"<[^>]+>", "", heading.group(1))).strip()
            index_items.append(
                f'<li><a href="{html.escape(artifact.name, quote=True)}">{html.escape(artifact_title)}</a>'
                f'<span class="status">Research signal · not proof of demand</span></li>'
            )
        except Exception:
            continue
    PULSE_INDEX.write_text(
        "<!doctype html>\n<html lang=\"en-NZ\"><head><meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
        "<title>DreamLedger Economic Observatory | Research Index</title>"
        "<meta name=\"description\" content=\"Source-linked commercial and economic research artifacts. "
        "Signals are candidates, not verified demand or revenue.\">"
        "<meta name=\"robots\" content=\"index,follow\">"
        "<style>body{max-width:900px;margin:40px auto;padding:0 20px;font:16px/1.6 system-ui;color:#182334}"
        "li{margin:14px 0}.status{display:block;color:#5c6878;font-size:13px}a{color:#075e57}</style>"
        "</head><body><main><p><a href=\"/\">DreamLedger</a> / 777 Economic Observatory</p>"
        "<h1>Research index</h1><p>Source-linked candidate signals and reusable components. "
        "Each page carries its own evidence boundary. A published page is not proof of buyer intent, "
        "settlement, fulfillment, or revenue.</p><ul>"
        + "\n".join(index_items[:100])
        + "</ul></main></body></html>\n",
        encoding="utf-8",
    )

    print(f"PULSE_INDEX={PULSE_INDEX}")
    print(f"INDEXED_ARTIFACT_LINKS={min(len(index_items), 100)}")
    print(f"PRIVATE_COMMERCIAL_SIGNAL={signal['title']}")
    print(f"PULSE={target}")
    print("TRUTH=UNVERIFIED")
    raise SystemExit(0)

raise SystemExit(
    "NO_PRIVATE_COMMERCIAL_SIGNAL: configured private-sector discovery feeds returned no admissible signal; "
    + ";".join(source_errors)
)

# 777 verification nonce 2026-10-09: exercise the existing scheduled-cycle path after the compounding-gate staging repair; no runtime behavior changed.
