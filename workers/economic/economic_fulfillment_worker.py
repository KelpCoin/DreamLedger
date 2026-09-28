#!/usr/bin/env python3
import csv, hashlib, json, os, time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from acnc_contacts_pipeline import run_acnc_contacts

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
WORKER_ID = os.environ.get("BEC_WORKER_ID", "economic-fulfillment-worker")
LEASE_SECONDS = int(os.environ.get("BEC_JOB_LEASE_SECONDS", "1200"))
ROOT = Path(os.environ.get("BEC_JOB_ROOT", str(Path.home() / "BrownEyeEconomicJobs")))
ROOT.mkdir(parents=True, exist_ok=True)

def api(url, method="GET", body=None):
    headers = {"apikey": SERVICE_KEY, "Authorization": "Bearer " + SERVICE_KEY, "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body is not None else None
    r = urlopen(Request(url, data=data, headers=headers, method=method), timeout=60)
    raw = r.read()
    return json.loads(raw.decode()) if raw else None

def rpc(name, args):
    return api(SUPABASE_URL + "/rest/v1/rpc/" + name, "POST", args)

def fetch(url):
    req = Request(url, headers={"User-Agent": "BrownEye-Economic-Fulfillment/1.0", "Accept": "*/*"})
    with urlopen(req, timeout=60) as r:
        return r.status, r.headers.get("content-type", ""), r.read()

def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()

def scalar(obj, path, default=""):
    cur = obj
    if not path: return cur
    for part in path.split("."):
        if isinstance(cur, dict): cur = cur.get(part, default)
        elif isinstance(cur, list) and part.isdigit() and int(part) < len(cur): cur = cur[int(part)]
        else: return default
    return cur

class TableParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows=[]; self.row=[]; self.cell=[]; self.in_cell=False
    def handle_starttag(self, tag, attrs):
        if tag in ("td","th"): self.in_cell=True; self.cell=[]
        elif tag=="tr": self.row=[]
    def handle_data(self, data):
        if self.in_cell: self.cell.append(data)
    def handle_endtag(self, tag):
        if tag in ("td","th") and self.in_cell:
            self.row.append(" ".join(" ".join(self.cell).split())); self.in_cell=False
        elif tag=="tr" and self.row: self.rows.append(self.row)

def extract_api(spec):
    status, ctype, body = fetch(spec["url"])
    data = json.loads(body.decode("utf-8-sig"))
    records = scalar(data, spec.get("records_path",""), data)
    if not isinstance(records,list): records=[records]
    rows=[]
    for item in records:
        row={name:scalar(item,path,"") for name,path in spec.get("fields",{}).items()}
        row["_source_url"]=spec["url"]; row["_source_status"]=status; rows.append(row)
    return rows,body,status,ctype

def extract_table(spec):
    status,ctype,body=fetch(spec["url"]); parser=TableParser(); parser.feed(body.decode("utf-8","replace"))
    if not parser.rows: return [],body,status,ctype
    headers=parser.rows[0]; rows=[]
    for raw in parser.rows[1:]:
        row={headers[i]:raw[i] if i<len(raw) else "" for i in range(len(headers))}
        row["_source_url"]=spec["url"]; row["_source_status"]=status; rows.append(row)
    return rows,body,status,ctype

def extract_links(spec):
    status,ctype,body=fetch(spec["url"])
    class Links(HTMLParser):
        def __init__(self): super().__init__(); self.items=[]
        def handle_starttag(self,tag,attrs):
            if tag=="a": self.items.append([dict(attrs).get("href",""),""])
        def handle_data(self,data):
            if self.items and not self.items[-1][1]: self.items[-1][1]=" ".join(data.split())
    parser=Links(); parser.feed(body.decode("utf-8","replace")); rows=[]
    for href,text in parser.items:
        if href: rows.append({"url":urljoin(spec["url"],href),"text":text,"_source_url":spec["url"],"_source_status":status})
    return rows,body,status,ctype

def run_acnc(payload):
    identifier = str(payload.get("charity_identifier") or "").strip()
    if not identifier:
        raise ValueError("ACNC charity identifier is required")
    from urllib.parse import quote
    resource_id = "8fb32972-24e9-4c95-885e-7140be51be8a"
    url = "https://data.gov.au/data/api/action/datastore_search?resource_id=" + resource_id + "&limit=5&q=" + quote(identifier)
    status, ctype, body = fetch(url)
    source_hash = sha256_bytes(body)
    data = json.loads(body.decode("utf-8-sig"))
    records = (((data or {}).get("result") or {}).get("records") or [])
    ident_norm = "".join(ch for ch in identifier.upper() if ch.isalnum())
    matches = []
    for row in records:
        abn = "".join(ch for ch in str(row.get("ABN") or "").upper() if ch.isalnum())
        legal = str(row.get("Charity_Legal_Name") or "").strip()
        if (ident_norm.isdigit() and abn == ident_norm) or (not ident_norm.isdigit() and legal.upper() == identifier.upper()):
            matches.append(row)
    selected = matches[0] if matches else (records[0] if len(records) == 1 else None)
    retrieved = datetime.now(timezone.utc).isoformat()
    evidence = [{
        "url": url,
        "type": "acnc_datastore_search",
        "http_status": status,
        "content_type": ctype,
        "sha256": source_hash,
        "retrieved_at": retrieved,
        "resource_id": resource_id
    }]
    rows = []
    if selected:
        row = dict(selected)
        row["_source_url"] = url
        row["_source_status"] = status
        row["_source_sha256"] = source_hash
        row["_retrieved_at"] = retrieved
        row["_evidence_status"] = "VERIFIED_SOURCE_RETRIEVAL" if status == 200 else "UNVERIFIED_SOURCE_STATUS"
        row["_match_status"] = "EXACT_IDENTIFIER_MATCH" if matches else "SINGLE_SEARCH_RESULT_REVIEW_REQUIRED"
        rows.append(row)
    return {
        "job_type": "ACNC_CHARITY_DUE_DILIGENCE",
        "charity_identifier": identifier,
        "match_status": "MATCHED" if matches else ("SINGLE_RESULT" if selected else "NO_MATCH"),
        "row_count": len(rows),
        "rows": rows,
        "evidence": evidence,
        "report_scope": "ACNC registered-charity identity and public-register fields; this is not a guarantee of safety, solvency, compliance, or suitability for funding."
    }

def run(payload):
    job_type = str(payload.get("job_type") or "")
    if job_type == "ACNC_CHARITY_DUE_DILIGENCE":
        return run_acnc(payload)
    if job_type == "ACNC_CHARITY_CONTACTS":
        return run_acnc_contacts(payload)
    specs=payload.get("sources") or []
    if not specs: raise ValueError("No public source specifications supplied")
    rows=[]; evidence=[]
    for spec in specs:
        kind=spec.get("type","api_json")
        if kind=="api_json": batch,raw,status,ctype=extract_api(spec)
        elif kind=="html_table": batch,raw,status,ctype=extract_table(spec)
        elif kind=="html_links": batch,raw,status,ctype=extract_links(spec)
        else: raise ValueError("Unsupported source type: "+kind)
        source_hash=sha256_bytes(raw); retrieved=datetime.now(timezone.utc).isoformat()
        for row in batch:
            row["_retrieved_at"]=retrieved; row["_source_sha256"]=source_hash
            row["_evidence_status"]="VERIFIED_SOURCE_RETRIEVAL" if status==200 else "UNVERIFIED_SOURCE_STATUS"
        rows.extend(batch)
        evidence.append({"url":spec["url"],"type":kind,"http_status":status,"content_type":ctype,"sha256":source_hash,"retrieved_at":retrieved})
    return {"job_type":payload.get("job_type"),"row_count":len(rows),"rows":rows,"evidence":evidence}

def write_artifacts(job_id,result):
    folder=ROOT/str(job_id); folder.mkdir(parents=True,exist_ok=True)
    (folder/"result.json").write_text(json.dumps(result,indent=2,ensure_ascii=True),encoding="utf-8")
    rows=result["rows"]; keys=sorted({k for row in rows for k in row})
    with open(folder/"results.csv","w",newline="",encoding="utf-8") as handle:
        writer=csv.DictWriter(handle,fieldnames=keys or ["_empty"]); writer.writeheader()
        for row in rows: writer.writerow(row)
    lines=["# BrownEye Economic Fulfillment","","- Job: `" + str(job_id) + "`","- Generated: `" + datetime.now(timezone.utc).isoformat() + "`","- Rows: `" + str(len(rows)) + "`","- Source-derived identity data is never fabricated.",""]
    if result.get("job_type") == "ACNC_CHARITY_DUE_DILIGENCE":
        lines.extend(["## ACNC Due Diligence Scope","", "- Identifier supplied: `" + str(result.get("charity_identifier","")) + "`", "- Match status: `" + str(result.get("match_status","UNKNOWN")) + "`", "- Scope: " + str(result.get("report_scope","")),""])
    if result.get("job_type") == "ACNC_CHARITY_CONTACTS":
        lines.extend(["## ACNC Contact Project","", "- States: `" + ",".join(result.get("states") or []) + "`", "- Fulfillment status: `" + str(result.get("fulfillment_status","UNKNOWN")) + "`", "- Provider state: `" + json.dumps(result.get("provider_state") or {}, sort_keys=True) + "`",""])
    lines.extend(["## Evidence",""])
    lines.extend("- " + e["url"] + " | HTTP " + str(e["http_status"]) + " | SHA256 `" + e["sha256"] + "`" for e in result["evidence"])
    (folder/"report.md").write_text("\n".join(lines)+"\n",encoding="utf-8"); return folder

def sha256_file(path):
    digest=hashlib.sha256()
    with open(path,"rb") as handle:
        for chunk in iter(lambda:handle.read(1024*1024),b""): digest.update(chunk)
    return digest.hexdigest()

def upload(path,storage_path):
    body=path.read_bytes(); url=SUPABASE_URL+"/storage/v1/object/marketplace-fulfillment/"+storage_path
    req=Request(url,data=body,headers={"apikey":SERVICE_KEY,"Authorization":"Bearer "+SERVICE_KEY,"Content-Type":"application/octet-stream","x-upsert":"true"},method="POST")
    with urlopen(req,timeout=60) as response: return response.status

def claim():
    try:
        rows=rpc("claim_economic_fulfillment_job",{"p_worker_id":WORKER_ID,"p_lease_seconds":LEASE_SECONDS})
        return rows[0] if rows else None
    except Exception:
        return None

def complete(job,result,folder):
    artifact=folder/"report.md"; digest=sha256_file(artifact); storage="economic-jobs/"+str(job["id"])+"/report.md"; upload(artifact,storage)
    return rpc("complete_economic_fulfillment_job",{"p_job_id":job["id"],"p_worker_id":WORKER_ID,"p_storage_path":storage,"p_sha256":digest,"p_byte_size":artifact.stat().st_size,"p_result":{"row_count":result["row_count"],"evidence":result["evidence"],"artifact_sha256":digest,"worker_id":WORKER_ID}})

def fail(job,reason):
    return rpc("fail_economic_fulfillment_job",{"p_job_id":job["id"],"p_worker_id":WORKER_ID,"p_reason":reason[:2000]})

def run_once():
    job=claim()
    if not job: return False
    try:
        result=run(job.get("payload") or {}); folder=write_artifacts(job["id"],result); complete(job,result,folder); return True
    except Exception as exc:
        fail(job,str(exc)); return True

if __name__=="__main__":
    if os.environ.get("BEC_ONCE")=="1": run_once()
    else:
        while run_once(): time.sleep(2)