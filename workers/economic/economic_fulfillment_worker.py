#!/usr/bin/env python3
import csv, hashlib, json, os, time, io, re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from acnc_contacts_pipeline import run_acnc_contacts
from economic_compute_trace import start_trace, observe_tool, finish_trace, write_trace
from substrate_admission import assess_trace

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
    if TRACE is not None:
        TRACE["current_operation"] = "SUPABASE_RPC"
        TRACE["current_dependency"] = SUPABASE_URL + "/rest/v1/rpc/" + name
    return api(SUPABASE_URL + "/rest/v1/rpc/" + name, "POST", args)

TRACE = None

def fetch(url):
    global TRACE
    if TRACE is not None:
        observe_tool(TRACE)
        TRACE["current_operation"] = "SOURCE_FETCH"
        TRACE["current_dependency"] = url
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

def download_storage(storage_path):
    if TRACE is not None:
        TRACE["current_operation"]="STORAGE_DOWNLOAD"
        TRACE["current_dependency"]=SUPABASE_URL
    url=SUPABASE_URL+"/storage/v1/object/authenticated/marketplace-fulfillment/"+"/".join(quote(part) for part in storage_path.split("/"))
    req=Request(url,headers={"User-Agent":"BrownEye-Economic-Fulfillment/1.0","Authorization":"Bearer "+SERVICE_KEY,"apikey":SERVICE_KEY})
    with urlopen(req,timeout=60) as r:
        return r.status,r.headers.get("content-type",""),r.read()

def extract_quote_file(name, raw):
    ext=name.lower().rsplit(".",1)[-1] if "." in name else ""
    if ext=="pdf":
        try:
            from pypdf import PdfReader
            reader=PdfReader(io.BytesIO(raw))
            text="\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as exc:
            raise ValueError("PDF_TEXT_EXTRACTION_FAILED:"+str(exc))
    elif ext=="csv":
        rows=list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig","replace"))))
        text="\n".join(" | ".join(f"{k}: {v}" for k,v in row.items()) for row in rows)
    elif ext=="json":
        text=json.dumps(json.loads(raw.decode("utf-8-sig")),indent=2,ensure_ascii=True)
    elif ext=="md":
        text=raw.decode("utf-8","replace")
    else:
        raise ValueError("UNSUPPORTED_QUOTE_FILE_TYPE:"+ext)
    return text

MONEY_RE=re.compile(r"(?i)(NZD|NZ\\$|USD|US\\$|AUD|AU\\$|EUR|GBP|\\$)\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)")
def quote_fields(name,text):
    lines=[" ".join(line.split()) for line in text.splitlines() if line.strip()]
    supplier=Path(name).stem.replace("_"," ").replace("-"," ").strip()
    for line in lines[:40]:
        if re.search(r"(?i)\\b(supplier|vendor|company)\\b",line):
            supplier=line.split(":",1)[-1].strip() or supplier
            break
    total=None; total_label=None
    for line in lines:
        if re.search(r"(?i)\\b(grand total|total due|total|amount due|quote total)\\b",line):
            hits=list(MONEY_RE.finditer(line))
            if hits:
                hit=hits[-1]; total={"currency":hit.group(1).upper().replace("\\$","$"),"amount":float(hit.group(2).replace(",",""))}; total_label=line
                break
    amounts=[]
    for line in lines:
        for m in MONEY_RE.finditer(line): amounts.append({"currency":m.group(1).upper().replace("\\$","$"),"amount":float(m.group(2).replace(",","")),"context":line})
    moq=next((line for line in lines if re.search(r"(?i)\\bMOQ\\b|minimum order",line)),None)
    lead=next((line for line in lines if re.search(r"(?i)lead time|delivery time|days? to deliver|weeks? to deliver",line)),None)
    terms=next((line for line in lines if re.search(r"(?i)payment terms|net \\d+|deposit|due on delivery|prepay",line)),None)
    return {"supplier":supplier,"stated_total":total,"total_source_line":total_label,"amounts_found":amounts[:100],"moq":moq,"lead_time":lead,"payment_terms":terms,"line_count":len(lines),"extracted_text_sha256":sha256_bytes(text.encode("utf-8"))}

def run_quote_comparison(payload):
    files=payload.get("input_files") or []
    if len(files)<2 or len(files)>5: raise ValueError("QUOTE_COMPARISON_REQUIRES_2_TO_5_FILES")
    comparisons=[]; evidence=[]
    for f in files:
        status,ctype,raw=download_storage(str(f["path"]))
        source_hash=sha256_bytes(raw)
        text=extract_quote_file(str(f["name"]),raw)
        fields=quote_fields(str(f["name"]),text)
        fields.update({"filename":f["name"],"storage_path":f["path"],"source_sha256":source_hash,"retrieved_at":datetime.now(timezone.utc).isoformat(),"source_status":status})
        comparisons.append(fields)
        evidence.append({"storage_path":f["path"],"filename":f["name"],"http_status":status,"content_type":ctype,"sha256":source_hash,"bytes":len(raw)})
    stated=[x for x in comparisons if x.get("stated_total")]
    lines=["# Supplier Quote Comparison","","## Purchase requirements",str(payload.get("requirements") or "").strip(),"","## Normalized comparison","","| Supplier | Stated total | MOQ | Lead time | Payment terms |","|---|---:|---|---|---|"]
    for q in comparisons:
        total=q.get("stated_total"); total_s=(str(total["currency"])+" "+format(total["amount"],",.2f")) if total else "UNKNOWN"
        lines.append("| "+q["supplier"].replace("|","/")+" | "+total_s+" | "+str(q.get("moq") or "UNKNOWN").replace("|","/")+" | "+str(q.get("lead_time") or "UNKNOWN").replace("|","/")+" | "+str(q.get("payment_terms") or "UNKNOWN").replace("|","/")+" |")
    lines.extend(["","## Exceptions and unknowns",""])
    if not stated: lines.append("- No explicit stated total was reliably extracted from any quote. No total was invented.")
    elif len({x["stated_total"]["currency"] for x in stated})>1: lines.append("- Currency mismatch: stated totals use multiple currencies. No FX conversion was invented.")
    else:
        ordered=sorted(stated,key=lambda x:x["stated_total"]["amount"]); lines.append("- Lowest stated total: "+ordered[0]["supplier"]+" at "+ordered[0]["stated_total"]["currency"]+" "+format(ordered[0]["stated_total"]["amount"],",.2f")+" based only on the stated total.")
    for q in comparisons:
        for label in ("moq","lead_time","payment_terms"):
            if not q.get(label): lines.append("- "+q["supplier"]+": "+label.replace("_"," ")+" is UNKNOWN.")
    lines.extend(["","## Evidence",""])
    for e in evidence: lines.append("- "+e["filename"]+" | SHA256 `"+e["sha256"]+"` | "+str(e["bytes"])+" bytes")
    lines.extend(["","## Decision boundary","","This packet compares stated source data. It does not invent missing values, silently convert currencies, or make a purchasing decision on the buyer's behalf."])
    return {"job_type":"QUOTE_COMPARISON","requirements":payload.get("requirements"),"quote_count":len(comparisons),"comparisons":comparisons,"evidence":evidence,"report_markdown":"\n".join(lines)+"\n"}
def run(payload):
    job_type = str(payload.get("job_type") or "")
    if job_type == "QUOTE_COMPARISON":
        return run_quote_comparison(payload)
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
    if TRACE is not None:
        write_trace(TRACE, folder)
    if result.get("job_type") == "QUOTE_COMPARISON":
        (folder/"quote-decision-packet.md").write_text(result.get("report_markdown",""),encoding="utf-8")
    (folder/"result.json").write_text(json.dumps(result,indent=2,ensure_ascii=True),encoding="utf-8")
    rows=result.get("rows") or result.get("comparisons") or []; keys=sorted({k for row in rows for k in row})
    with open(folder/"results.csv","w",newline="",encoding="utf-8") as handle:
        writer=csv.DictWriter(handle,fieldnames=keys or ["_empty"]); writer.writeheader()
        for row in rows: writer.writerow(row)
    lines=["# BrownEye Economic Fulfillment","","- Job: `" + str(job_id) + "`","- Generated: `" + datetime.now(timezone.utc).isoformat() + "`","- Rows: `" + str(len(rows)) + "`","- Source-derived identity data is never fabricated.",""]
    admission=result.get("_substrate_admission")
    if admission:
        lines.extend(["## Substrate Admission","","- Decision: `" + str(admission.get("admission")) + "`","- Trace: `" + str(admission.get("economic_trace_id")) + "`","- Dependency failed: `" + str(admission.get("dependency_failed")) + "`","- Material cost unknown: `" + str(admission.get("material_cost_unknown")) + "`",""])
    if result.get("job_type") == "ACNC_CHARITY_DUE_DILIGENCE":
        lines.extend(["## ACNC Due Diligence Scope","", "- Identifier supplied: `" + str(result.get("charity_identifier","")) + "`", "- Match status: `" + str(result.get("match_status","UNKNOWN")) + "`", "- Scope: " + str(result.get("report_scope","")), ""])
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
    if TRACE is not None:
        TRACE["current_operation"] = "STORAGE_UPLOAD"
        TRACE["current_dependency"] = SUPABASE_URL
    body=path.read_bytes(); url=SUPABASE_URL+"/storage/v1/object/marketplace-fulfillment/"+storage_path
    req=Request(url,data=body,headers={"apikey":SERVICE_KEY,"Authorization":"Bearer "+SERVICE_KEY,"Content-Type":"application/octet-stream","x-upsert":"true"},method="POST")
    with urlopen(req,timeout=60) as response: return response.status

def claim():
    rows=rpc("claim_economic_fulfillment_job",{"p_worker_id":WORKER_ID,"p_lease_seconds":LEASE_SECONDS})
    return rows[0] if rows else None

def complete(job,result,folder):
    root="economic-jobs/"+str(job["id"])
    artifacts=[]
    for filename in ("report.md","quote-decision-packet.md","results.csv","result.json","economic_compute_trace.json"):
        path=folder/filename
        storage=root+"/"+filename
        upload(path,storage)
        artifacts.append({
            "filename":filename,
            "storage_path":storage,
            "sha256":sha256_file(path),
            "byte_size":path.stat().st_size,
        })
    report=next(item for item in artifacts if item["filename"]=="quote-decision-packet.md") if result.get("job_type")=="QUOTE_COMPARISON" else next(item for item in artifacts if item["filename"]=="report.md")
    completed=rpc("complete_economic_fulfillment_job",{
        "p_job_id":job["id"],"p_worker_id":WORKER_ID,"p_lease_token":job["lease_token"],
        "p_storage_path":report["storage_path"],"p_sha256":report["sha256"],
        "p_byte_size":report["byte_size"],
        "p_result":{
            "row_count":result.get("row_count",result.get("quote_count",0)),"evidence":result["evidence"],
            "artifact_sha256":report["sha256"],"worker_id":WORKER_ID,
            "artifacts":artifacts,
            "substrate_admission":result.get("_substrate_admission"),
        },
    })
    if result.get("job_type")=="QUOTE_COMPARISON":
        fr_id=str(result.get("fulfillment_request_id") or "")
        if fr_id:
            api(SUPABASE_URL+"/rest/v1/fulfillment_requests?id=eq."+fr_id,"PATCH",{"status":"fulfilled","canonical_state":"DELIVERED","fulfillment_reference":report["storage_path"],"evidence_reference":json.dumps({"artifacts":artifacts,"source_evidence":result.get("evidence",[])}),"evidence_status":"VERIFIED","updated_at":datetime.now(timezone.utc).isoformat()})
            sess=str(result.get("stripe_checkout_session_id") or "")
            if sess:
                api(SUPABASE_URL+"/rest/v1/economic_events?stripe_checkout_session=eq."+quote(sess),"PATCH",{"fulfilment_verified":True,"evidence_verified":True,"fulfillment_state":"DELIVERED","verification_state":"VERIFIED","output_hash":report["sha256"],"updated_at":datetime.now(timezone.utc).isoformat()})
    return completed

def fail(job,reason):
    return rpc("fail_economic_fulfillment_job",{"p_job_id":job["id"],"p_worker_id":WORKER_ID,"p_lease_token":job["lease_token"],"p_reason":reason[:2000]})

def run_once():
    global TRACE
    job=claim()
    if not job: return False
    payload=job.get("payload") or {}
    action_id=payload.get("action_id") or payload.get("economic_action_id") or job.get("action_id")
    opportunity_id=payload.get("opportunity_id") or job.get("opportunity_id")
    TRACE=start_trace(action_id, opportunity_id)
    try:
        result=run(payload)
        if result.get("job_type")=="QUOTE_COMPARISON":
            result["fulfillment_request_id"]=payload.get("fulfillment_request_id")
            result["stripe_checkout_session_id"]=payload.get("stripe_checkout_session_id")
        finish_trace(TRACE, "AVAILABLE")
        admission=assess_trace(TRACE)
        result["_substrate_admission"]=admission
        if admission["admission"] != "SURVIVES":
            TRACE["failure_class"]="SUBSTRATE_ADMISSION"
            TRACE["resource_condition"]=admission["admission"]
            finish_trace(TRACE, "FAILED", "SUBSTRATE_ADMISSION", None, admission["admission"])
            folder=write_artifacts(job["id"],result)
            trace_path=folder/"economic_compute_trace.json"
            storage_path="economic-jobs/"+str(job["id"])+"/economic_compute_trace.json"
            upload(trace_path,storage_path)
            reason=("SUBSTRATE_ADMISSION | trace="+TRACE["economic_trace_id"]+
                    " | admission="+admission["admission"]+
                    " | action="+str(action_id)+
                    " | opportunity="+str(opportunity_id)+
                    " | trace_storage="+storage_path)
            fail(job,reason)
            return True
        folder=write_artifacts(job["id"],result)
        complete(job,result,folder)
        return True
    except Exception as exc:
        failure_class="WORKER_FAILURE"
        http_status=None
        resource_condition=None
        if isinstance(exc, HTTPError):
            http_status=exc.code
            if exc.code == 502:
                failure_class="WORKER_RESOURCE_LIMIT"
                resource_condition="HTTP_502"
        elif isinstance(exc, URLError):
            failure_class="DEPENDENCY_FAILURE"
            resource_condition="URL_ERROR"
        failed_dependency = TRACE.get("current_dependency")
        if failed_dependency:
            TRACE["dependency_cut_set"] = [failed_dependency]
        finish_trace(TRACE, "FAILED", failure_class, http_status, resource_condition)
        folder=ROOT/str(job["id"])
        folder.mkdir(parents=True,exist_ok=True)
        write_trace(TRACE, folder)
        try:
            trace_path=folder/"economic_compute_trace.json"
            storage_path="economic-jobs/"+str(job["id"])+"/economic_compute_trace.json"
            upload(trace_path, storage_path)
            reason=(
                "WORKER_FAILED | trace="+TRACE["economic_trace_id"]+
                " | failure_class="+failure_class+
                " | http_status="+str(http_status)+
                " | resource_condition="+str(resource_condition)+
                " | trace_storage="+storage_path+
                " | "+str(exc)
            )
        except Exception:
            reason="WORKER_FAILED | trace="+TRACE["economic_trace_id"]+" | failure_class="+failure_class+" | trace_upload_failed | "+str(exc)
        fail(job,reason)
        return True

if __name__=="__main__":
    if os.environ.get("BEC_ONCE")=="1": run_once()
    else:
        while run_once(): time.sleep(2)
