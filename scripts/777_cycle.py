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

SOURCE = "https://www.stats.govt.nz/information-releases/"
ROOT = Path("webapp")
PULSE = ROOT / "pulse"
INDEX = ROOT / "index.html"
PULSE.mkdir(parents=True, exist_ok=True)

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.href = None
        self.buf = []
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            d = dict(attrs)
            href = d.get("href", "")
            if href.startswith("/") and ("information-releases" in href or "news" in href):
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

def fetch():
    req = urllib.request.Request(
        SOURCE,
        headers={"User-Agent": "DreamLedger-777/1.0 (+https://dreamledger.org)"}
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:100]

def absolute(href):
    return "https://www.stats.govt.nz" + href if href.startswith("/") else href

raw = fetch()
p = LinkParser()
p.feed(raw)

seen = set()
signals = []
for href, title in p.links:
    url = absolute(href)
    if url in seen:
        continue
    seen.add(url)
    if len(title) < 12:
        continue
    signals.append({"title": title, "url": url})

if not signals:
    raise SystemExit("No Stats NZ signal found.")

signal = signals[0]
now = datetime.now(timezone.utc)
key = hashlib.sha256((signal["url"] + "|" + signal["title"]).encode()).hexdigest()[:16]
filename = f"{now.date().isoformat()}-{slug(signal['title'])}-{key}.html"
target = PULSE / filename

if not target.exists():
    cta = os.environ.get("CTA_URL") or "/"
    title = html.escape(signal["title"])
    url = html.escape(signal["url"], quote=True)
    published = now.isoformat()

    body = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>777 Economic Pulse: {title}</title>
<meta name="robots" content="index,follow">
</head>
<body>
<main>
<p><a href="/">DreamLedger</a> / 777 Economic Pulse</p>
<h1>{title}</h1>
<p><strong>Observed:</strong> {published}</p>
<p><strong>Source:</strong> <a href="{url}" rel="noopener noreferrer">Stats NZ</a></p>
<section>
<h2>Economic event</h2>
<p>This page records an externally published economic signal. It is an observation, not proof of buyer demand, revenue, or a completed commercial outcome.</p>
</section>
<section>
<h2>777 response surface</h2>
<p>The signal is now a durable, addressable artifact that can be evaluated for audience, offer, message, CTA, and measurable response.</p>
<p><a href="{html.escape(cta, quote=True)}">Open the current response surface</a></p>
</section>
<script type="application/ld+json">
{json.dumps({"@context":"https://schema.org","@type":"Article","headline":signal["title"],"datePublished":published,"isBasedOn":{"@type":"WebPage","url":signal["url"]}}, indent=2)}
</script>
</main>
</body>
</html>
"""
    target.write_text(body, encoding="utf-8")

# Regenerate a deterministic index from all pulses.
items = []
for f in sorted(PULSE.glob("*.html"), reverse=True):
    text = f.read_text(encoding="utf-8", errors="ignore")
    m = re.search(r"<h1>(.*?)</h1>", text, re.S)
    t = re.sub("<[^>]+>", "", m.group(1)).strip() if m else f.stem
    items.append(f'<li><a href="pulse/{html.escape(f.name, quote=True)}">{html.escape(t)}</a></li>')

index = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DreamLedger 777</title>
<meta name="description" content="A continuously growing economic signal and response surface.">
</head>
<body>
<main>
<h1>DreamLedger 777</h1>
<p>WORLD → ECONOMIC SIGNAL → ARTIFACT → RESPONSE SURFACE → MEASURABLE OUTCOME.</p>
<p>Observed signals are published here as durable artifacts. They are not treated as revenue proof.</p>
<h2>Latest economic pulses</h2>
<ul>
""" + "\n".join(items[:100]) + """
</ul>
</main>
</body>
</html>
"""
INDEX.write_text(index, encoding="utf-8")
print(f"pulse={target}")
