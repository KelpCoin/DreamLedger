import argparse, json, os, sys, time, tempfile, xml.etree.ElementTree as StdET
from pathlib import Path
from . import core, bundle, importer, beck_adapter


def cfg_load(p):
    c = json.load(open(p, encoding="utf-8"))
    if not c.get("feeds"): sys.exit("config needs a non-empty 'feeds' list: [{\"name\":..., \"url\":\"https://<publication>.substack.com/feed\"}]")
    return c


def main(argv=None):
    ap = argparse.ArgumentParser(prog="substack_ingest"); sp = ap.add_subparsers(dest="cmd", required=True)
    r = sp.add_parser("run"); r.add_argument("--config", default="config.json"); r.add_argument("--db", default="ingest.sqlite"); r.add_argument("--outbox", default="outbox")
    v = sp.add_parser("verify"); v.add_argument("bundle")
    i = sp.add_parser("import"); i.add_argument("bundle"); i.add_argument("--kb", required=True)
    p = sp.add_parser("probe", help="one real PUBLIC feed verification; no persistent article export"); p.add_argument("--url", required=True); p.add_argument("--out", help="optional metadata-only JSON proof output")
    b = sp.add_parser("beck-export", help="export metadata-only, untrusted public research evidence to BECK"); b.add_argument("--kb", required=True); b.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    if a.cmd == "run":
        cfg = cfg_load(a.config); db = core.open_db(a.db); now = time.time()
        res = core.ingest(db, cfg["feeds"], delay=cfg.get("delay_s", 1.0)); d = bundle.write_bundle(db, res, cfg, a.outbox, now)
        print(json.dumps(dict(new=len(res["new"]), health=res["health"], bundle=d), indent=2)); return 1 if any(h["status"] == "FAILED" for h in res["health"]) else 0
    if a.cmd == "probe":
        # Ephemeral, credential-free, single-feed compatibility test. Never upload article text.
        try:
            status, raw, _, _ = core.http_fetch(a.url)
            if status != 200: raise core.FetchError("unexpected HTTP %s" % status)
            parsed = core.parse_feed(raw)
            if not parsed: raise core.FetchError("feed contains no RSS or Atom items")
            # Parse same bytes independently to check no item is silently skipped.
            xml_root = StdET.fromstring(raw)  # safe only after defusedxml successfully parsed/rejected
            expected = sum(1 for _ in xml_root.iter('item')) + sum(1 for _ in xml_root.iter('{http://www.w3.org/2005/Atom}entry'))
            if len(parsed) != expected: raise core.FetchError("parser lost %s feed entries" % (expected-len(parsed)))
            from datetime import datetime, timezone
            with tempfile.TemporaryDirectory(prefix="beck-substack-live-probe-") as temp:
                db = core.open_db(os.path.join(temp, 'probe.sqlite'))
                try:
                    def single_fetch(url, etag, lm): return status, raw, None, None
                    res = core.ingest(db, [{"name":"Live-public-feed-probe", "url":a.url}], fetch=single_fetch, delay=0, sleep=lambda _:None)
                    if len(res['new']) != len(parsed): raise core.FetchError("ingested count differs from feed entry count")
                    bd = bundle.write_bundle(db,res, {"watchlist": ["agent"]},os.path.join(temp,"outbox"),time.time())
                    checked = bundle.verify_bundle(bd)
                    if not checked['ok']: raise core.FetchError("bundle verification failed")
                    imported = importer.import_bundle(bd, os.path.join(temp,"kb"))
                finally:
                    db.close()
            proof = dict(schema="beck/substack-public-feed-live-probe/v1",status="PASS",source_url=a.url,
                         captured_utc=datetime.now(timezone.utc).isoformat(),
                         feed_entry_count=expected,parsed_items=len(parsed),ingested_items=len(res['new']),
                         imported_items=imported['added'],bundle_hashes_verified=True,
                         content_encoded_items=sum(bool(it.findtext('{http://purl.org/rss/1.0/modules/content/}encoded')) for it in xml_root.iter('item')),
                         preview_flagged=sum('likely-paywalled-preview' in core.flags_for(core.html_to_text(x['html']),x['title']) for x in parsed),
                         no_cookie_used=True,no_articles_exported=True, no_payment_or_posting=True,
                         caveat="A live snapshot verifies parsing, not future Substack compatibility or all paid previews.")
            if a.out:
                Path(a.out).parent.mkdir(parents=True,exist_ok=True)
                Path(a.out).write_text(json.dumps(proof,indent=2)+"\n",encoding="utf-8")
            print(json.dumps(proof,indent=2)); return 0
        except Exception as e:
            print(json.dumps({"status":"FAIL", "source_url":a.url, "reason":str(e)[:300]})); return 3
    if a.cmd == "beck-export": print(json.dumps(beck_adapter.export_kb_evidence(a.kb, a.out), indent=2)); return 0
    if a.cmd == "verify": r = bundle.verify_bundle(a.bundle); print(json.dumps(r)); return 0 if r["ok"] else 2
    if a.cmd == "import": print(json.dumps(importer.import_bundle(a.bundle, a.kb))); return 0
if __name__ == "__main__": sys.exit(main())
