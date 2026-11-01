import hashlib, ipaddress, json, os, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

SUPABASE_URL=(os.environ.get("SUPABASE_URL") or os.environ.get("PROJECT_URL") or "").rstrip("/")
if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL is required")
SERVICE_KEY=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
WORKER_ID=os.environ.get("BEC_WORKER_ID", f"commander-{os.environ.get('COMPUTERNAME','pc')}")
LM_MODEL=(os.environ.get("CLOUD_MODEL_NAME") or "").strip()
LEASE=int(os.environ.get("BEC_FULFILLMENT_LEASE_SECONDS","900"))
ROOT=Path(os.environ.get("BEC_WORKER_ROOT", str(Path.home()/"DreamLedgerMarketplace")))
CACHE=ROOT/"scryfall-cache"; CACHE.mkdir(parents=True,exist_ok=True)


def req(url, method="GET", body=None, headers=None):
    h={"apikey":SERVICE_KEY,"Authorization":f"Bearer {SERVICE_KEY}","Content-Type":"application/json"}
    if headers: h.update(headers)
    data=json.dumps(body).encode() if body is not None else None
    r=urllib.request.urlopen(urllib.request.Request(url,data=data,headers=h,method=method),timeout=60)
    raw=r.read(); return json.loads(raw.decode()) if raw else None

def rpc(name, args): return req(f"{SUPABASE_URL}/rest/v1/rpc/{name}","POST",args)

def sha256(p):
    h=hashlib.sha256(); n=0
    with open(p,"rb") as f:
        while True:
            b=f.read(1024*1024)
            if not b: break
            n+=len(b); h.update(b)
    return h.hexdigest(),n

def parse_deck(text):
    """Match the paid same-origin 100-card intake contract before any enrichment."""
    if not isinstance(text,str) or not 20<=len(text)<=30000:
        raise RuntimeError("DECKLIST_REQUIRES_CORRECTION")
    rows=[]; total=0
    for raw in text.splitlines():
        s=raw.strip()
        if not s or s.startswith("#") or s.startswith("//"):
            continue
        if re.match(r"^(sideboard|maybeboard|considering)\b",s,re.I):
            raise RuntimeError("DECKLIST_REQUIRES_CORRECTION")
        if re.fullmatch(r"(commander|mainboard|deck)\s*:",s,re.I):
            continue
        s=re.sub(r"^(commander|mainboard|deck)\s*:\s*","",s,flags=re.I)
        if re.match(r"^\d",s):
            m=re.fullmatch(r"(\d{1,3})x?\s+(.+)",s,flags=re.I)
            if not m:
                raise RuntimeError("DECKLIST_REQUIRES_CORRECTION")
            qty,name=int(m.group(1)),m.group(2).strip()
        else:
            qty,name=1,s
        if (not 1<=qty<=100 or not name or len(name)>160 or
                re.search(r"[<>{}\x00-\x1f]",name) or
                re.search(r"https?://|www\.",name,re.I)):
            raise RuntimeError("DECKLIST_REQUIRES_CORRECTION")
        rows.append((qty,name)); total+=qty
        if total>100 or len(rows)>100:
            raise RuntimeError("DECKLIST_REQUIRES_CORRECTION")
    if total!=100:
        raise RuntimeError("DECKLIST_REQUIRES_CORRECTION")
    return rows


def scryfall_batch(names):
    key=hashlib.sha256("\n".join(sorted(names)).encode()).hexdigest()+".json"
    cp=CACHE/key
    if cp.exists() and time.time()-cp.stat().st_mtime < 2592000: return json.loads(cp.read_text())
    payload={"identifiers":[{"name":n} for n in names]}
    r=urllib.request.urlopen(urllib.request.Request("https://api.scryfall.com/cards/collection",data=json.dumps(payload).encode(),headers={"Content-Type":"application/json","User-Agent":"DreamLedger-CommanderDiagnostic/1.0"},method="POST"),timeout=60)
    data=json.loads(r.read().decode())
    cp.write_text(json.dumps(data),encoding="utf-8")
    time.sleep(0.15)
    return data

def analyze(text):
    rows=parse_deck(text); names=[n for _,n in rows]
    cards=[]
    for i in range(0,len(names),75):
        cards += scryfall_batch(names[i:i+75]).get("data",[])
    by={c.get("name",""):c for c in cards}
    total=sum(q for q,_ in rows); lands=ramp=draw=interaction=tutors=wraths=0; cmcs=[]; colors=set(); commander=[]
    for q,n in rows:
        c=by.get(n,{})
        typ=c.get("type_line",""); oracle=(c.get("oracle_text") or "").lower(); cmc=float(c.get("cmc") or 0)
        cmcs += [cmc]*q; colors.update(c.get("color_identity") or [])
        if "land" in typ.lower(): lands+=q
        if any(x in oracle for x in ["add {", "search your library for a basic land"]): ramp+=q
        if "draw" in oracle and "card" in oracle: draw+=q
        if any(x in oracle for x in ["counter target", "destroy target", "exile target", "return target"]): interaction+=q
        if "search your library" in oracle: tutors+=q
        if any(x in oracle for x in ["each creature gets", "destroy all creatures", "exile all creatures", "all creatures get"]): wraths+=q
        if "legendary creature" in typ.lower() and not commander: commander.append(n)
    missing=[n for _,n in rows if n not in by]
    return {"total_cards":total,"unique_names":len(set(names)),"resolved_cards":len(cards),"unresolved_names":missing,"lands":lands,"ramp":ramp,"draw":draw,"interaction":interaction,"tutors":tutors,"wraths":wraths,"avg_cmc":round(sum(cmcs)/len(cmcs),2) if cmcs else 0,"color_identity":sorted(colors),"possible_commanders":commander[:10],"deck_hash":hashlib.sha256(text.encode()).hexdigest()}

def model_request(prompt):
    """Approved cloud model only. Never forward Supabase service credentials."""
    endpoint=(os.environ.get("CLOUD_MODEL_API_URL") or "").strip()
    token=(os.environ.get("CLOUD_MODEL_API_KEY") or "").strip()
    if not endpoint or not token or not LM_MODEL:
        raise RuntimeError("CLOUD_MODEL_NOT_CONFIGURED")
    parsed=urllib.parse.urlsplit(endpoint)
    host=(parsed.hostname or "").lower()
    if parsed.scheme!="https" or not host or parsed.username or parsed.password or parsed.fragment or host in ("localhost","localhost.localdomain") or host.endswith(".local"):
        raise RuntimeError("CLOUD_MODEL_ENDPOINT_NOT_APPROVED")
    try:
        ip=ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        if not ip.is_global:
            raise RuntimeError("CLOUD_MODEL_ENDPOINT_NOT_APPROVED")
    data=json.dumps(prompt,separators=(",",":")).encode("utf-8")
    request=urllib.request.Request(endpoint,data=data,headers={
        "Content-Type":"application/json",
        "Authorization":f"Bearer {token}",
        "Accept":"application/json"
    },method="POST")
    try:
        with urllib.request.urlopen(request,timeout=25) as response:
            raw=response.read(262145)
    except Exception:
        raise RuntimeError("CLOUD_MODEL_REQUEST_FAILED") from None
    if len(raw)>262144:
        raise RuntimeError("CLOUD_MODEL_RESPONSE_TOO_LARGE")
    try:
        return json.loads(raw.decode("utf-8"))
    except (ValueError,UnicodeError):
        raise RuntimeError("CLOUD_MODEL_RESPONSE_INVALID") from None


def lm_diagnose(text,metrics):
    schema={"executive_summary":"string","overall_score_0_to_100":"number","confidence":"string","strengths":[{"title":"string","detail":"string","evidence":"string"}],"weaknesses":[{"title":"string","severity":"string","detail":"string","evidence":"string"}],"recommended_cuts":[{"card":"string","reason":"string"}],"recommended_additions":[{"card":"string","reason":"string"}]}
    prompt={"model":LM_MODEL,"temperature":0.2,"max_tokens":900,"messages":[{"role":"system","content":"You are a Commander deck diagnostic writer. Use the measured metrics as facts. Do not invent card text. Clearly label uncertainty. Return JSON only."},{"role":"user","content":json.dumps({"metrics":metrics,"decklist":text,"schema":schema})}],"response_format":{"type":"json_object"}}
    response=model_request(prompt)
    try:
        diagnostic=json.loads(response["choices"][0]["message"]["content"])
        score=diagnostic["overall_score_0_to_100"]
        if not isinstance(diagnostic.get("executive_summary"),str) or len(diagnostic["executive_summary"].strip())<30:
            raise ValueError("missing summary")
        if isinstance(score,bool) or not isinstance(score,(int,float)) or not 0<=score<=100:
            raise ValueError("invalid score")
        for field in ("strengths","weaknesses","recommended_cuts","recommended_additions"):
            if not isinstance(diagnostic.get(field),list):
                raise ValueError("missing analysis")
        if not (diagnostic["strengths"] or diagnostic["weaknesses"]):
            raise ValueError("empty analysis")
        return diagnostic
    except (KeyError,IndexError,TypeError,ValueError):
        raise RuntimeError("CLOUD_MODEL_DIAGNOSTIC_INVALID") from None

def report(order_id,metrics,diag):
    out=["# Commander Deck Diagnostic","",f"**Order:** `{order_id}`",f"**Generated:** {time.strftime('%Y-%m-%d %H:%M UTC',time.gmtime())}",f"**Deck hash:** `{metrics['deck_hash']}`","","## Executive Summary","",str(diag.get('executive_summary','')),"",f"**Overall score:** {diag.get('overall_score_0_to_100','N/A')}/100 · **Confidence:** {diag.get('confidence','UNKNOWN')}","","## Measured Metrics","","These values are computed from resolved Scryfall card records.","",f"- Total cards: {metrics['total_cards']}",f"- Resolved card records: {metrics['resolved_cards']}",f"- Unresolved names: {len(metrics['unresolved_names'])}",f"- Lands: {metrics['lands']}",f"- Average CMC: {metrics['avg_cmc']}",f"- Color identity observed: {', '.join(metrics['color_identity']) or 'none'}","", "## Heuristic Classifications", "", f"- Ramp: {metrics['ramp']}",f"- Draw: {metrics['draw']}",f"- Interaction: {metrics['interaction']}",f"- Tutors: {metrics['tutors']}",f"- Wrath-like effects: {metrics['wraths']}","","These classifications are heuristic and approximate.","","## Strengths"]
    for x in diag.get("strengths",[]): out += [f"### {x.get('title','Strength')}","",x.get('detail',''),"",f"Evidence: {x.get('evidence','')}",""]
    out += ["## Weaknesses",""]
    for x in diag.get("weaknesses",[]): out += [f"### {x.get('title','Weakness')} · {x.get('severity','UNKNOWN')}","",x.get('detail',''),"",f"Evidence: {x.get('evidence','')}",""]
    out += ["## Recommended Cuts",""]+[f"- **{x.get('card','')}** — {x.get('reason','')}" for x in diag.get('recommended_cuts',[])]+["","## Recommended Additions",""]+[f"- **{x.get('card','')}** — {x.get('reason','')}" for x in diag.get('recommended_additions',[])]+["","_This is a structured diagnostic, not a guarantee._"]
    return "\n".join(out)+"\n"

def upload(path,storage_path):
    data=Path(path).read_bytes()
    url=f"{SUPABASE_URL}/storage/v1/object/marketplace-fulfillment/{storage_path}"
    r=urllib.request.urlopen(urllib.request.Request(url,data=data,headers={"apikey":SERVICE_KEY,"Authorization":f"Bearer {SERVICE_KEY}","Content-Type":"text/markdown","x-upsert":"true"},method="POST"),timeout=60)
    return r.status

def run_once():
    jobs=rpc("claim_marketplace_fulfillment",{"p_worker_id":WORKER_ID,"p_lease_seconds":LEASE})
    if not jobs: return False
    job=jobs[0]; fid=job["fulfillment_id"]
    try:
        payload=job.get("input_payload") or {}; deck=payload.get("decklist")
        if not deck: rpc("fail_marketplace_fulfillment",{"p_fulfillment_id":fid,"p_worker_id":WORKER_ID,"p_reason":"awaiting_buyer_input"}); return True
        metrics=analyze(deck); diag=lm_diagnose(deck,metrics); ROOT.mkdir(parents=True,exist_ok=True)
        local=ROOT/f"{fid}.md"; local.write_text(report(job["order_id"],metrics,diag),encoding="utf-8")
        h,size=sha256(local); storage=f"{fid}/report.md"; upload(local,storage)
        rpc("complete_marketplace_fulfillment",{"p_fulfillment_id":fid,"p_worker_id":WORKER_ID,"p_storage_bucket":"marketplace-fulfillment","p_storage_path":storage,"p_sha256":h,"p_byte_size":size,"p_metadata":{"deck_hash":metrics["deck_hash"],"model":LM_MODEL,"analyzer":"scryfall-heuristics-v1"}})
        return True
    except Exception as e:
        allowed={"CLOUD_MODEL_NOT_CONFIGURED","CLOUD_MODEL_ENDPOINT_NOT_APPROVED","CLOUD_MODEL_REQUEST_FAILED","CLOUD_MODEL_RESPONSE_TOO_LARGE","CLOUD_MODEL_RESPONSE_INVALID","CLOUD_MODEL_DIAGNOSTIC_INVALID"}
        reason="awaiting_buyer_input" if str(e)=="DECKLIST_REQUIRES_CORRECTION" else (str(e) if str(e) in allowed else "FULFILLMENT_WORKER_FAILED")
        rpc("fail_marketplace_fulfillment",{"p_fulfillment_id":fid,"p_worker_id":WORKER_ID,"p_reason":reason}); return True

if __name__=="__main__":
    while True:
        did=run_once()
        if os.environ.get("BEC_ONCE")=="1" or not did: break
        time.sleep(15)
