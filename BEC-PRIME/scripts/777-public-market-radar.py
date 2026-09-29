#!/usr/bin/env python3
import json, re, sys, urllib.parse, urllib.request, xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime, timezone

OUT = Path("BEC-PRIME/data/777/public-market-radar.json")
QUERIES = [
    "business paying for data cleaning service",
    "business paying for compliance research service",
    "business paying for reconciliation service",
    "business paying for lead research service",
    "business paying for document processing service",
    "business paying for monitoring service",
    "business paying for procurement research service",
    "business paying for evidence gathering service",
    "business paying for marketplace operations service",
    "business paying for agent supervision service",
]
def fetch(q):
    url = "https://news.google.com/rss/search?q=" + urllib.parse.quote(q) + "&hl=en-US&gl=US&ceid=US:en"
    req = urllib.request.Request(url, headers={"User-Agent":"DreamLedger-777/1.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read()
def main():
    rows=[]
    errors=[]
    for q in QUERIES:
        try:
            root=ET.fromstring(fetch(q))
            for item in root.findall("./channel/item")[:10]:
                title=(item.findtext("title") or "").strip()
                link=(item.findtext("link") or "").strip()
                pub=(item.findtext("pubDate") or "").strip()
                if title and link:
                    rows.append({"query":q,"title":title,"url":link,"published":pub,"source_type":"PUBLIC_NEWS_RSS","status":"UNVERIFIED_DEMAND_SIGNAL"})
        except Exception as e:
            errors.append({"query":q,"error":str(e)})
    out={
        "schema_version":"DREAMLEDGER/777/PUBLIC-MARKET-RADAR/v1",
        "generated_at_utc":datetime.now(timezone.utc).isoformat(),
        "purpose":"surface public demand signals for human/research review; not proof of willingness to pay",
        "queries":QUERIES,
        "results":rows,
        "errors":errors,
        "truth_boundary":{"revenue_nzd":0,"settled_external_payments":0,"independent_external_buyers":0,"verified_economic_outcomes":0}
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":"PASS","signals":len(rows),"errors":len(errors),"output":str(OUT)}))
if __name__=="__main__":
    main()
