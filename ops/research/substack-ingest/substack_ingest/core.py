"""Public RSS/Atom only; defusedxml enforced. No credentials, scraping, or paywall bypass."""
import hashlib, html, ipaddress, json, re, socket, sqlite3, time, urllib.error, urllib.parse, urllib.request
from defusedxml import ElementTree as ET
from defusedxml.common import DefusedXmlException
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser

MAX_BYTES = 5 * 1024 * 1024
UA = "bec-substack-ingest/0.1 (personal reader; contact: set in config)"
INJECTION = [r"ignore (all |any )?(the )?(previous|prior|above) (instructions|prompts?)", r"disregard (the |all )?(previous|above|system)", r"system prompt",
             r"reveal (your )?(instructions|prompt)", r"</?(system|assistant|tool)>", r"you are now ", r"override (the )?(rules|safety)"]
HIDDEN = re.compile("[\u200b\u200c\u200d\u2060\ufeff\U000E0000-\U000E007F]")
NS = {"content": "{http://purl.org/rss/1.0/modules/content/}encoded", "dc": "{http://purl.org/dc/elements/1.1/}creator", "atom": "{http://www.w3.org/2005/Atom}"}


class FetchError(Exception):
    pass


def check_url(url, allow_private=False):
    """SSRF guard for a cloud host: https only, public IPs only (re-checked on every redirect)."""
    u = urllib.parse.urlparse(url)
    if u.scheme != "https" and not (allow_private and u.scheme == "http"): raise FetchError("only https URLs allowed: %s" % url)
    if not u.hostname: raise FetchError("no host")
    if u.username or u.password or u.fragment or (u.port is not None and u.port != 443 and not allow_private):
        raise FetchError("feed URL contains forbidden credentials, fragment or port")
    try: infos = socket.getaddrinfo(u.hostname, u.port or (80 if allow_private and u.scheme == "http" else 443), proto=socket.IPPROTO_TCP)
    except (socket.gaierror, ValueError, OverflowError) as e: raise FetchError("dns or URL failure: %s" % e)
    for i in infos:
        ip = ipaddress.ip_address(i[4][0])
        if not allow_private and (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified):
            raise FetchError("refusing non-public address %s for %s" % (ip, u.hostname))
    return True


class _Redirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, allow_private): self.allow_private = allow_private
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        check_url(newurl, self.allow_private); return super().redirect_request(req, fp, code, msg, headers, newurl)


def http_fetch(url, etag=None, lastmod=None, timeout=20, allow_private=False, ua=UA):
    """Returns (status, body_bytes, etag, last_modified). 304 -> body b''."""
    check_url(url, allow_private)
    op = urllib.request.build_opener(urllib.request.ProxyHandler({}), _Redirect(allow_private))
    h = {"User-Agent": ua, "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.1"}
    if etag: h["If-None-Match"] = etag
    if lastmod: h["If-Modified-Since"] = lastmod
    try:
        with op.open(urllib.request.Request(url, headers=h), timeout=timeout) as r:
            body = r.read(MAX_BYTES + 1)
            if len(body) > MAX_BYTES: raise FetchError("response larger than %d bytes" % MAX_BYTES)
            return r.status, body, r.headers.get("ETag"), r.headers.get("Last-Modified")
    except urllib.error.HTTPError as e:
        if e.code == 304: return 304, b"", etag, lastmod
        raise FetchError("HTTP %d" % e.code)
    except (urllib.error.URLError, socket.timeout, OSError) as e:
        raise FetchError("network: %s" % e)


class _Text(HTMLParser):
    BLOCK = {"p", "br", "div", "li", "h1", "h2", "h3", "h4", "blockquote", "tr"}
    def __init__(self): super().__init__(convert_charrefs=True); self.out, self.skip = [], 0
    def handle_starttag(self, t, a):
        if t in ("script", "style"): self.skip += 1
        if t in self.BLOCK: self.out.append("\n")
    def handle_endtag(self, t):
        if t in ("script", "style") and self.skip: self.skip -= 1
        if t in self.BLOCK: self.out.append("\n")
    def handle_data(self, d):
        if not self.skip: self.out.append(d)


def html_to_text(s):
    p = _Text()
    try: p.feed(s); p.close()
    except Exception: return re.sub(r"<[^>]+>", " ", html.unescape(s))   # fallback: tag strip
    t = "".join(p.out); t = re.sub(r"[ \t\xa0]+", " ", t); return re.sub(r"\n\s*\n+", "\n\n", t).strip()


def _iso(s):
    if not s: return None
    try:
        d = parsedate_to_datetime(s)
    except (TypeError, ValueError):
        try: d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError: return None
    if d.tzinfo is None: d = d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_feed(body):
    """RSS 2.0 or Atom -> list of dicts. DTD/entity declarations rejected (entity-expansion defence)."""
    if len(body) > MAX_BYTES: raise FetchError("feed XML too large")
    lowered = body.lower()
    if b"<!doctype" in lowered or b"<!entity" in lowered: raise FetchError("DTD/ENTITY in feed rejected")
    try: root = ET.fromstring(body)
    except (ET.ParseError, DefusedXmlException, ValueError) as e: raise FetchError("feed XML unsafe or invalid: %s" % e)
    items = []
    for it in root.iter("item"):
        g = lambda tag: (it.findtext(tag) or "").strip()
        raw = it.findtext(NS["content"]) or g("description")
        items.append(dict(guid=g("guid") or g("link"), title=g("title"), link=g("link"), author=(it.findtext(NS["dc"]) or g("author")).strip(), published=_iso(g("pubDate")), html=raw))
    for en in root.iter(NS["atom"] + "entry"):
        a = lambda tag: (en.findtext(NS["atom"] + tag) or "").strip()
        ln = en.find(NS["atom"] + "link"); au = en.find(NS["atom"] + "author/" + NS["atom"] + "name")
        items.append(dict(guid=a("id"), title=a("title"), link=(ln.get("href") if ln is not None else ""), author=(au.text if au is not None else ""), published=_iso(a("published") or a("updated")), html=a("content") or a("summary")))
    return items


def flags_for(text, title=""):
    f = ["injection-pattern" for p in INJECTION if re.search(p, text + " " + title, re.I)][:1]
    if HIDDEN.search(text): f.append("hidden-characters")
    if len(text) < 400 and re.search(r"(paid subscribers|subscribe to (continue|read)|upgrade to paid|this post is for paid)", text, re.I): f.append("likely-paywalled-preview")
    return f


SCHEMA = """
CREATE TABLE IF NOT EXISTS feeds(url TEXT PRIMARY KEY, name TEXT, etag TEXT, lastmod TEXT, fail_count INTEGER DEFAULT 0, last_ok TEXT, last_error TEXT, next_try REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS articles(id TEXT PRIMARY KEY, feed_url TEXT, feed_name TEXT, title TEXT, author TEXT, published TEXT, link TEXT, text TEXT, text_sha256 TEXT, flags TEXT, fetched_at TEXT);
"""


def open_db(path):
    db = sqlite3.connect(path); db.executescript(SCHEMA); db.row_factory = sqlite3.Row; return db


def now_iso(t=None): return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t or time.time()))


def ingest(db, feeds, fetch=http_fetch, now=None, delay=1.0, max_items=200, sleep=time.sleep):
    """One run. Returns dict(new=[article dicts], health=[...]). Never raises for a single bad feed."""
    now = now or time.time(); new, health = [], []
    for fd in feeds:
        url, name = fd["url"], fd.get("name") or fd["url"]
        db.execute("INSERT OR IGNORE INTO feeds(url,name) VALUES(?,?)", (url, name))
        st = db.execute("SELECT * FROM feeds WHERE url=?", (url,)).fetchone()
        if now < (st["next_try"] or 0):
            health.append(dict(feed=name, status="backing-off", fail_count=st["fail_count"], error=st["last_error"])); continue
        try:
            status, body, etag, lm = fetch(url, st["etag"], st["lastmod"])
            if status == 304:
                db.execute("UPDATE feeds SET last_ok=?,fail_count=0,next_try=0 WHERE url=?", (now_iso(now), url))
                health.append(dict(feed=name, status="unchanged"))
                db.commit()
                continue
            items = parse_feed(body)[:max_items]; n = 0
            for it in items:
                aid = hashlib.sha256((url + "|" + (it["guid"] or it["link"])).encode()).hexdigest()
                if db.execute("SELECT 1 FROM articles WHERE id=?", (aid,)).fetchone(): continue
                text = html_to_text(it["html"] or ""); fl = flags_for(text, it["title"])
                rec = dict(id=aid, feed_url=url, feed_name=name, title=it["title"], author=it["author"], published=it["published"], link=it["link"], text=text,
                           text_sha256=hashlib.sha256(text.encode()).hexdigest(), flags=fl, fetched_at=now_iso(now))
                db.execute("INSERT INTO articles VALUES(?,?,?,?,?,?,?,?,?,?,?)", (aid, url, name, rec["title"], rec["author"], rec["published"], rec["link"], text, rec["text_sha256"], json.dumps(fl), rec["fetched_at"]))
                new.append(rec); n += 1
            db.execute("UPDATE feeds SET etag=?,lastmod=?,fail_count=0,last_ok=?,last_error=NULL,next_try=0 WHERE url=?", (etag, lm, now_iso(now), url))
            health.append(dict(feed=name, status="ok", new=n, items=len(items)))
        except FetchError as e:
            fc = st["fail_count"] + 1; wait = min(6 * 3600, 300 * 2 ** fc)       # fallback 1: exponential backoff
            db.execute("UPDATE feeds SET fail_count=?,last_error=?,next_try=? WHERE url=?", (fc, str(e)[:300], now + wait, url))
            health.append(dict(feed=name, status="FAILED", fail_count=fc, error=str(e)[:200], retry_in_s=wait))   # fallback 2: surfaced in the digest, never silent
        db.commit(); sleep(delay)
    db.commit(); return dict(new=new, health=health)
