#!/usr/bin/env bash
# Linux LM Studio three-role council bootstrap. No cloud calls or model downloads.
# Requires: lms CLI, curl, python3. Uses explicit model keys to avoid guessing roles.
set -Eeuo pipefail

PORT="\${BECK_LMSTUDIO_PORT:-1234}"
BASE="http://127.0.0.1:\${PORT}"
SCOUT_MODEL="\${BECK_SCOUT_MODEL:-}"
CRITICAL_MODEL="\${BECK_CRITICAL_MODEL:-}"
VISUAL_MODEL="\${BECK_VISUAL_MODEL:-}"
PROOF="\${BECK_COUNCIL_PROOF:-\${HOME}/.local/state/beck/LMSTUDIO-THREE-ROLE-READINESS.json}"
mkdir -p "$(dirname "$PROOF")"

write_fail() {
  local msg="$1"
  python3 - "$PROOF" "$BASE" "$msg" <<'PY'
import json,sys,datetime
path,server,error=sys.argv[1:]
obj={"schema":"BEC-LMSTUDIO-LINUX-COUNCIL-1.0","status":"FAIL","readiness":"NOT_READY","server":server,"verified_at_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),"error":error}
with open(path,"w",encoding="utf-8") as f: json.dump(obj,f,indent=2)
print(json.dumps(obj,indent=2))
PY
}
fail() { write_fail "$1"; exit 2; }

command -v lms >/dev/null 2>&1 || fail "lms CLI not found. Install LM Studio and ensure its CLI is on PATH."
command -v curl >/dev/null 2>&1 || fail "curl is required."
command -v python3 >/dev/null 2>&1 || fail "python3 is required."
[[ -n "$SCOUT_MODEL" && -n "$CRITICAL_MODEL" && -n "$VISUAL_MODEL" ]] || fail "Set BECK_SCOUT_MODEL, BECK_CRITICAL_MODEL, and BECK_VISUAL_MODEL to exact model keys from 'lms ls'."
[[ "$SCOUT_MODEL" != "$CRITICAL_MODEL" && "$SCOUT_MODEL" != "$VISUAL_MODEL" && "$CRITICAL_MODEL" != "$VISUAL_MODEL" ]] || fail "Scout, Critical, and Visual must be three distinct model keys."

if ! curl -fsS --max-time 3 "\${BASE}/v1/models" >/dev/null 2>&1; then
  lms server start --port "$PORT" || fail "Could not start LM Studio server on port \${PORT}."
fi
for _ in $(seq 1 30); do
  curl -fsS --max-time 3 "\${BASE}/v1/models" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS --max-time 5 "\${BASE}/v1/models" >/dev/null 2>&1 || fail "LM Studio API not responding at \${BASE}/v1/models."

lms load "$SCOUT_MODEL" --gpu max || fail "Could not load Scout model: $SCOUT_MODEL"
lms load "$CRITICAL_MODEL" --gpu max || fail "Could not load Critical model: $CRITICAL_MODEL"
lms load "$VISUAL_MODEL" --gpu max || fail "Could not load Visual model: $VISUAL_MODEL"

export BASE SCOUT_MODEL CRITICAL_MODEL VISUAL_MODEL PROOF
python3 <<'PY'
import json, os, sys, urllib.request, datetime, subprocess, shutil
base=os.environ["BASE"]
roles=[("Scout",os.environ["SCOUT_MODEL"]),("Critical",os.environ["CRITICAL_MODEL"]),("Visual",os.environ["VISUAL_MODEL"])]
proof={"schema":"BEC-LMSTUDIO-LINUX-COUNCIL-1.0","status":"FAIL","readiness":"NOT_READY","server":base,"required_roles":["Scout","Critical","Visual"],"roles":[],"verified_at_utc":datetime.datetime.now(datetime.timezone.utc).isoformat()}
def get_models():
    with urllib.request.urlopen(base+"/v1/models",timeout=15) as r: data=json.load(r)
    return [str(x.get("id","")) for x in data.get("data",[]) if x.get("id")]
try:
    visible=get_models()
    for role,key in roles:
        model=next((x for x in visible if x==key or key in x or x in key),None)
        if not model: raise RuntimeError(f"{role} model '{key}' not visible via API after load; visible IDs: {visible}")
        expected=role.upper().replace(" ","_")+"_ROLE_OK"
        payload={"model":model,"messages":[{"role":"system","content":"You are a readiness probe. Follow the exact output instruction."},{"role":"user","content":"Reply with exactly "+expected}],"temperature":0,"max_tokens":32}
        req=urllib.request.Request(base+"/v1/chat/completions",data=json.dumps(payload).encode(),headers={"Content-Type":"application/json"},method="POST")
        with urllib.request.urlopen(req,timeout=180) as r: answer=json.load(r)
        text=str(answer.get("choices",[{}])[0].get("message",{}).get("content",""))
        if expected not in text: raise RuntimeError(f"{role} inference expected {expected!r}; got {text!r}")
        proof["roles"].append({"role":role,"model_key":key,"api_model_id":model,"inference":"PASS"})
    visible_final=get_models()
    absent=[x["role"]+"="+x["api_model_id"] for x in proof["roles"] if x["api_model_id"] not in visible_final]
    if absent: raise RuntimeError("Not all three models remain simultaneously visible: "+", ".join(absent))
    proof["visible_models_final"]=visible_final
    if shutil.which("nvidia-smi"):
        p=subprocess.run(["nvidia-smi","--query-gpu=name,driver_version,memory.total,memory.used,utilization.gpu","--format=csv,noheader"],capture_output=True,text=True,timeout=10)
        proof["nvidia_smi_status"]="PASS" if p.returncode==0 else "FAIL"
        proof["gpu_snapshot"]=p.stdout.strip() if p.returncode==0 else p.stderr.strip()
    else:
        proof["nvidia_smi_status"]="UNAVAILABLE"
        proof["gpu_snapshot"]=None
    proof["status"]="PASS"
    proof["readiness"]="THREE_DISTINCT_ROLES_INFERENCE_VERIFIED"
    proof["note"]="Each role passed a real inference check and all three IDs remained visible together. GPU snapshot is diagnostic, not proof that every layer ran exclusively on GPU."
except Exception as e:
    proof["error"]=str(e)
    proof["status"]="FAIL"
    proof["readiness"]="NOT_READY"
with open(os.environ["PROOF"],"w",encoding="utf-8") as f: json.dump(proof,f,indent=2)
print(json.dumps(proof,indent=2))
if proof["status"]!="PASS": sys.exit(2)
PY
