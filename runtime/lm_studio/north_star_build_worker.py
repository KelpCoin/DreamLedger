#!/usr/bin/env python3
"""Issue-scoped North Star queue adapter. Defaults to non-mutating preview."""
import hashlib, json, os, re, shutil, subprocess, urllib.error, urllib.request
from datetime import datetime, timezone
from pathlib import Path

SCHEMA="dreamledger/north-star-build-worker/v1"
CONTRACTS={712:"ops/cube-swarm/tasks/MTG-STORE-AUDIT-BUILD.json"}
PRIORITY=(712,715,716,717,718,713,714,719,720)

def now():
    return datetime.now(timezone.utc).isoformat()

def sha(data):
    return hashlib.sha256(data).hexdigest()

def result(status, reason=None, **fields):
    row={"schema":SCHEMA,"status":status,"timestamp_utc":now(),"human_gate":True,
         "external_action_performed":False,"verified_revenue_nzd":0}
    if reason: row["reason"]=reason
    row.update(fields)
    return row

def parse_issue(value):
    if isinstance(value,int) and value in PRIORITY: return value
    if not isinstance(value,str): return None
    text=value.strip().lstrip("#").strip()
    if text.isdigit() and int(text) in PRIORITY: return int(text)
    match=re.search(r"/issues/(\d+)",text,re.I)
    if not match: match=re.search(r"ISSUE[-_ ](\d+)",text,re.I)
    if match and int(match.group(1)) in PRIORITY: return int(match.group(1))
    return None

def job_issue(job):
    if not isinstance(job,dict): return None
    p=job.get("payload") if isinstance(job.get("payload"),dict) else {}
    values=[job.get("task_issue"),job.get("issue_number"),p.get("task_issue"),p.get("issue_number"),
            p.get("github_issue"),p.get("issue_url"),p.get("github_issue_url"),p.get("task_id")]
    for key in ("task","contract","metadata","work_item"):
        n=p.get(key)
        if isinstance(n,dict): values += [n.get("task_issue"),n.get("issue_number"),n.get("github_issue"),n.get("issue_url"),n.get("task_id")]
    for value in values:
        issue=parse_issue(value)
        if issue is not None: return issue
    return None

def select_candidate(jobs, priority=PRIORITY):
    if not isinstance(jobs,list): return None
    grouped={}
    for job in jobs:
        if not isinstance(job,dict): continue
        status=str(job.get("status",job.get("state",""))).lower()
        if status and status not in {"queued","pending","open","ready"}: continue
        issue=job_issue(job)
        if issue in priority: grouped.setdefault(issue,[]).append(job)
    for issue in priority:
        rows=grouped.get(issue,[])
        if rows:
            rows.sort(key=lambda x:(str(x.get("created_at") or ""),str(x.get("id") or x.get("job_id") or "")))
            return rows[0]
    return None

def safe_path(root, relative):
    p=Path(relative)
    if not relative or p.is_absolute() or ".." in p.parts: raise ValueError("PATH_OUTSIDE_REPOSITORY")
    target=(root/p).resolve()
    try: target.relative_to(root.resolve())
    except ValueError: raise ValueError("PATH_OUTSIDE_REPOSITORY") from None
    return target

def load_contract(root, issue=712):
    rel=CONTRACTS.get(issue)
    if not rel: raise ValueError("NO_CONTRACT_FOR_ALLOWED_ISSUE")
    path=safe_path(root,rel)
    if not path.is_file(): raise FileNotFoundError(rel)
    c=json.loads(path.read_text(encoding="utf-8"))
    if c.get("schema_version")!="dreamledger/bounded-build-task/v1": raise ValueError("TASK_CONTRACT_SCHEMA_INVALID")
    if parse_issue(c.get("github_issue"))!=issue: raise ValueError("TASK_CONTRACT_ISSUE_MISMATCH")
    if not c.get("source_refs") or not c.get("writable_paths"): raise ValueError("TASK_CONTRACT_PATHS_MISSING")
    if c.get("authorization",{}).get("internal_file_build_allowed") is not True: raise ValueError("INTERNAL_BUILD_NOT_AUTHORIZED")
    return c

def gather_sources(root, contract):
    inventory, content, missing, total=[],{},[],0
    for ref in contract["source_refs"]:
        rel=ref if isinstance(ref,str) else ref.get("path") if isinstance(ref,dict) else None
        if not isinstance(rel,str): continue
        path=safe_path(root,rel)
        if not path.is_file(): missing.append(rel); continue
        data=path.read_bytes(); total+=len(data)
        if total>120000: raise ValueError("SOURCE_BUNDLE_TOO_LARGE")
        try: content[rel]=data.decode("utf-8")
        except UnicodeDecodeError: missing.append(rel); continue
        inventory.append({"path":rel,"bytes":len(data),"sha256":sha(data)})
    if missing: raise FileNotFoundError("SOURCE_FILES_MISSING:"+",".join(missing))
    return inventory,content

class BridgeClient:
    def __init__(self,base=None,token=None):
        supa=os.environ.get("SUPABASE_URL","").rstrip("/")
        self.base=(base or os.environ.get("AGENT_BRIDGE_PROXY_URL","") or (supa+"/functions/v1/agent-bridge-proxy" if supa else "")).rstrip("/")
        self.token=token if token is not None else os.environ.get("DREAMLEDGER_AGENT_BRIDGE_TOKEN","")
    @property
    def configured(self): return bool(self.base and self.token.strip())
    def request(self,path,body):
        if not self.configured: raise RuntimeError("BRIDGE_NOT_CONFIGURED")
        payload={"path":path,"method":"POST","body":body}
        req=urllib.request.Request(self.base,data=json.dumps(payload).encode(),
            headers={"Content-Type":"application/json","x-dreamledger-agent-token":self.token},method="POST")
        try:
            with urllib.request.urlopen(req,timeout=20) as r:
                data=r.read(180001)
                if len(data)>180000: raise RuntimeError("BRIDGE_RESPONSE_TOO_LARGE")
                return json.loads(data.decode() or "null")
        except urllib.error.HTTPError as e:
            detail=" ".join(e.read(800).decode("utf-8","replace").split())[:350]
            if "rpc not allowed" in detail.lower() or "function not found" in detail.lower(): raise RuntimeError("DISPATCH_RPC_NOT_AVAILABLE") from None
            raise RuntimeError("BRIDGE_HTTP_"+str(e.code)+":"+detail) from None
        except (urllib.error.URLError,TimeoutError,OSError,json.JSONDecodeError): raise RuntimeError("BRIDGE_TRANSPORT_FAILED") from None
    def preview(self,issue,worker): return normalize_job(self.request("rpc/select_north_star_build_job",{"p_task_issue":issue,"p_worker_id":worker}))
    def claim(self,issue,worker): return normalize_job(self.request("rpc/claim_north_star_build_job",{"p_task_issue":issue,"p_worker_id":worker,"p_lease_seconds":900}))
    def record(self,job,worker,artifact):
        jid=str(job.get("id") or job.get("job_id") or "")
        self.request("control_bridge_notes",{"from_agent":worker,"to_agent":"truth_oracle","note_type":"STRUCTURED_EVENT",
            "subject":"NORTH_STAR_BUILD_ARTIFACT:"+jid,"body":json.dumps(artifact,sort_keys=True),
            "requires_response":False,"event_id":"NORTH-STAR-BUILD-"+jid,"correlation_id":"NORTH-STAR-BUILD-"+jid,
            "lane":"execution","priority":100,"silo_id":"SILO_GENERAL","source_system":"north-star-build-worker"})
    def complete(self,job):
        if not job.get("id") or not job.get("lease_token"): raise RuntimeError("CLAIM_RECEIPT_MISSING_FENCE")
        self.request("rpc/complete_job",{"p_job_id":job["id"],"p_lease_token":job["lease_token"]})
    def fail(self,job,reason):
        if job.get("id") and job.get("lease_token"):
            self.request("rpc/fail_job",{"p_job_id":job["id"],"p_lease_token":job["lease_token"],"p_error":reason[:1500]})

def normalize_job(raw):
    if raw is None: return None
    if isinstance(raw,list): return normalize_job(raw[0]) if raw else None
    if not isinstance(raw,dict): return None
    for key in ("select_north_star_build_job","claim_north_star_build_job","data","result","job"):
        if key in raw: return normalize_job(raw[key])
    return raw if raw.get("id") or raw.get("job_id") else None

def run_cycle(root,bridge=None,execute=None,executor=None):
    root=Path(root).resolve()
    enabled=execute if execute is not None else os.environ.get("NORTH_STAR_BUILD_WORKER_EXECUTE","").lower() in {"1","true","yes"}
    worker=os.environ.get("NORTH_STAR_BUILD_WORKER_ID","north-star-local").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{2,64}",worker): return result("HOLD","WORKER_ID_INVALID")
    try:
        contract=load_contract(root,712)
        sources,_=gather_sources(root,contract)
    except FileNotFoundError as e: return result("HOLD","SOURCE_FILES_MISSING",missing=str(e))
    except Exception as e: return result("HOLD","TASK_CONTRACT_INVALID",error=(type(e).__name__+":"+str(e))[:500])
    client=bridge or BridgeClient()
    if not getattr(client,"configured",False): return result("HOLD","BRIDGE_NOT_CONFIGURED",task_issue=712,source_files=sources)
    try: candidate=client.preview(712,worker)
    except Exception as e:
        reason="DISPATCH_RPC_NOT_AVAILABLE" if "DISPATCH_RPC_NOT_AVAILABLE" in str(e) else "QUEUE_PREVIEW_FAILED"
        return result("HOLD",reason,error=str(e)[:500],task_issue=712,source_files=sources)
    if candidate is None: return result("HOLD","NO_ELIGIBLE_JOB",task_issue=712,source_files=sources)
    if job_issue(candidate)!=712: return result("HOLD","JOB_SCOPE_MISMATCH",job_id=candidate.get("id") or candidate.get("job_id"))
    jid=candidate.get("id") or candidate.get("job_id")
    if not enabled: return result("DRY_RUN_READY","EXECUTION_DISABLED_NO_LEASE_TAKEN",task_issue=712,job_id=jid,source_files=sources,claim_performed=False)
    if os.environ.get("NORTH_STAR_BUILD_WORKER_PUBLISH_PR","").lower() not in {"1","true","yes"}:
        return result("HOLD","PR_PUBLISH_NOT_ENABLED_NO_LEASE_TAKEN",job_id=jid,claim_performed=False)
    if not shutil.which("gh"):
        return result("HOLD","GH_CLI_NOT_AVAILABLE_NO_LEASE_TAKEN",job_id=jid,claim_performed=False)
    auth=subprocess.run(["gh","auth","status"],capture_output=True,text=True,timeout=15,shell=False)
    if auth.returncode:
        return result("HOLD","GH_AUTH_NOT_AVAILABLE_NO_LEASE_TAKEN",job_id=jid,claim_performed=False)
    try: claimed=client.claim(712,worker)
    except Exception as e: return result("HOLD","CLAIM_FAILED",error=str(e)[:500],job_id=jid,claim_performed=False)
    if claimed is None or str(claimed.get("id") or claimed.get("job_id"))!=str(jid):
        return result("HOLD","CLAIM_CONFLICT",preview_job_id=jid,claimed_job_id=(claimed or {}).get("id") if claimed else None,claim_performed=claimed is not None)
    try:
        runner=executor
        if runner is None:
            from north_star_build_executor import build
            runner=build
        built=runner(root,contract,claimed)
        if built.get("status")=="BUILD_READY":
            client.record(claimed,worker,built); client.complete(claimed); built["queue_completion_recorded"]=True
        else:
            client.record(claimed,worker,built); client.fail(claimed,built.get("reason","BUILD_FAILED")+":"+str(built.get("error",""))); built["queue_failure_recorded"]=True
        built["queue_claim_performed"]=True
        return built
    except Exception as e:
        try: client.fail(claimed,(type(e).__name__+":"+str(e))[:1500])
        except Exception: pass
        return result("HOLD","BUILD_OR_LEDGER_HANDOFF_FAILED",job_id=jid,queue_claim_performed=True,error=(type(e).__name__+":"+str(e))[:500])
