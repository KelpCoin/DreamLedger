import os, re, json, hashlib, urllib.request, urllib.parse
from xml.etree import ElementTree as ET
from datetime import datetime, timezone

SUPABASE_URL=os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
REDDIT_SUBREDDITS=[x.strip() for x in os.environ.get("CUBE_REDDIT_SUBREDDITS","").split(",") if x.strip()]
SUBSTACK_FEEDS=[x.strip() for x in os.environ.get("CUBE_SUBSTACK_FEEDS","").split(",") if x.strip()]
MAX_PER_FEED=int(os.environ.get("CUBE_MAX_ITEMS_PER_FEED","25"))
UA="BrownEye-CUBE-DemandIngest/1.0"

def get(url):
    req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":"application/rss+xml,application/atom+xml,text/xml,*/*"})
    with urllib.request.urlopen(req,timeout=30) as r:
        return r.read()

def text(node, names):
    for n in names:
        x=node.find(".//{*}"+n)
        if x is not None and x.text:
            return x.text.strip()
    return ""

def fetch_items(url, source):
    root=ET.fromstring(get(url))
    nodes=root.findall(".//item") or root.findall(".//{*}entry")
    out=[]
    for n in nodes[:MAX_PER_FEED]:
        title=text(n,["title"])
        link=text(n,["link"])
        if not link:
            l=n.find(".//{*}link")
            link=(l.attrib.get("href","") if l is not None else "")
        body=text(n,["description","summary","content","encoded"])[:700]
        if not title and not body:
            continue
        out.append({"source":source,"url":link,"title":title,"body":body})
    return out

def intent_candidate(item):
    s=(item["title"]+" "+item["body"]).lower()
    patterns=[
        r"\b(i|we)('m| are| would be)? (buying|willing to pay|paid|pre.?ordered|ordered)",
        r"\bwhere can i (buy|get|order|purchase)\b",
        r"\bhow much (does|is|are)\b",
        r"\bshut up and take my money\b",
        r"\blooking to (buy|purchase|order)\b",
        r"\bneed (this|one|it) (now|today)\b"
    ]
    return any(re.search(p,s) for p in patterns)

def post(rows):
    if not rows: return
    url=SUPABASE_URL+"/rest/v1/demand_signals"
    data=json.dumps(rows).encode()
    req=urllib.request.Request(url,data=data,method="POST",headers={
        "apikey":SUPABASE_KEY,"Authorization":"Bearer "+SUPABASE_KEY,
        "Content-Type":"application/json","Prefer":"resolution=ignore-duplicates,return=minimal"
    })
    with urllib.request.urlopen(req,timeout=60) as r:
        r.read()

def main():
    feeds=[]
    for sub in REDDIT_SUBREDDITS:
        feeds.append((f"https://www.reddit.com/r/{sub}/new/.rss",f"reddit:r/{sub}"))
    for feed in SUBSTACK_FEEDS:
        feeds.append((feed,f"substack:{feed}"))
    rows=[]
    now=datetime.now(timezone.utc).isoformat()
    for url,source in feeds:
        try:
            for x in fetch_items(url,source):
                key=hashlib.sha256((source+"|"+x["url"]+"|"+x["title"]).encode()).hexdigest()
                rows.append({
                    "silo":"CUBE_DISCOVERY",
                    "signal_key":key,
                    "observed_at":now,
                    "source":source,
                    "evidence_ref":x["url"] or None,
                    "price_nzd":None,
                    "currency":"NZD",
                    "availability":"OBSERVED",
                    "normalized_demand_score":None,
                    "access_tier":"PUBLIC",
                    "payload":{
                        "title":x["title"][:240],"body":x["body"][:700],"url":x["url"],"data_use":"discovery_only",
                        "intent_candidate":intent_candidate(x),
                        "provenance":"external_feed",
                        "status":"RAW_UNFILTERED","redistribution":"PROHIBITED","payment_proof":"NEVER_INFER_FROM_LANGUAGE"
                    },
                    "demand_evidence_status":"UNVERIFIED",
                    "payment_intent_status":"UNVERIFIED",
                    "gauntlet_verdict":"PENDING",
                    "truth_verdict":"PENDING",
                    "publication_state":"HIDDEN",
                    "provenance":{"source":source,"feed_url":url,"retrieved_at":now},
                    "dedupe_key":key
                })
        except Exception as e:
            print("FEED_ERROR",source,str(e))
    post(rows)
    print(json.dumps({"status":"PASS","feeds":len(feeds),"signals_ingested":len(rows),"publication":"NONE"}))

if __name__=="__main__":
    main()
