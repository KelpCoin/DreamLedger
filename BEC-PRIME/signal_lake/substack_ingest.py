#!/usr/bin/env python3
import argparse, datetime as dt, hashlib, json, os, urllib.request, urllib.error
import xml.etree.ElementTree as ET

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "DreamLedger-SignalLake/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

def txt(node, tag):
    x = node.find(tag)
    return (x.text or "").strip() if x is not None and x.text else ""

def parse_feed(data, feed_url):
    root = ET.fromstring(data)
    channel = root.find("channel")
    if channel is None:
        raise RuntimeError("RSS channel missing: " + feed_url)
    rows = []
    for item in channel.findall("item"):
        title = txt(item, "title")
        link = txt(item, "link")
        guid = txt(item, "guid") or link or title
        description = txt(item, "description")
        raw = "\n".join(x for x in [title, description] if x)
        rows.append({
            "source": "SUBSTACK_RSS",
            "source_item_id": guid,
            "source_url": link,
            "observed_at": now(),
            "published_at": txt(item, "pubDate") or None,
            "raw_content": raw,
            "raw_metadata": {"feed_url": feed_url, "title": title},
            "content_hash": hashlib.sha256(raw.encode()).hexdigest(),
            "source_type": "RSS",
            "provenance": {"ingestor": "substack_ingest.py", "feed_url": feed_url}
        })
    return rows

def post(row):
    url = SUPABASE_URL + "/rest/v1/rpc/ingest_bronze_observation"
    body = json.dumps({"p_observation": row}).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json"
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read().decode()
    except urllib.error.HTTPError as exc:
        raise RuntimeError("Bronze RPC failed: " + exc.read().decode("utf-8", "replace"))

def main():
    p = argparse.ArgumentParser()
    p.add_argument("feeds", nargs="+")
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args()
    rows = []
    for feed in a.feeds:
        rows.extend(parse_feed(fetch(feed), feed))
    if a.dry_run:
        print(json.dumps({"status":"DRY_RUN","count":len(rows),"sample":rows[:2]}, indent=2))
        return
    if not SUPABASE_URL or not KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    for row in rows:
        post(row)
    print(json.dumps({"status":"PASS","source":"SUBSTACK_RSS","fetched":len(rows),"written":len(rows)}, indent=2))

if __name__ == "__main__":
    main()
