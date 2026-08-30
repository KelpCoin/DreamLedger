import json
import os
import sys
import subprocess
import tempfile
import hashlib

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SEC = os.path.join(ROOT, 'security')
GATEWAY = os.path.join(SEC, 'gateway.py')
MANIFEST = os.path.join(SEC, 'mcp-gateway-manifest.json')
POLICY = os.path.join(SEC, 'mcp-gateway-policy.json')
MIRROR = os.path.join(ROOT, 'compiled', 'security', 'mcp-gateway-manifest.json')
PROOF = os.path.join(ROOT, 'data', 'proofs', 'mcp-gateway-verification-latest.json')

checks = []
def check(name, ok, detail):
    checks.append({'name': name, 'status': 'PASS' if ok else 'FAIL', 'detail': detail})
    print(('PASS' if ok else 'FAIL') + ': ' + name + ' - ' + detail)

def canonical(m):
    body = {k: m[k] for k in ('schema_version','gateway','transport','protocol_version','tools')}
    return json.dumps(body, indent=2) + '\n'

check('FILES_GATEWAY', os.path.isfile(GATEWAY), GATEWAY)
check('FILES_MANIFEST', os.path.isfile(MANIFEST), MANIFEST)
check('FILES_POLICY', os.path.isfile(POLICY), POLICY)
check('FILES_MIRROR', os.path.isfile(MIRROR), MIRROR)

if all(os.path.isfile(x) for x in (GATEWAY, MANIFEST, POLICY, MIRROR)):
    with open(MANIFEST, encoding='utf-8') as f: manifest = json.load(f)
    with open(POLICY, encoding='utf-8') as f: policy = json.load(f)
    with open(MIRROR, encoding='utf-8') as f: mirror = json.load(f)
    computed = hashlib.sha256(canonical(manifest).encode()).hexdigest()
    check('MANIFEST_HASH', computed == manifest.get('manifest_hash'), 'SHA-256 recomputation')
    check('MIRROR_HASH', mirror.get('manifest_hash') == manifest.get('manifest_hash'), 'Compiler mirror matches')
    check('POLICY_ZERO_SPEND', policy['authority']['autonomous_spend_nzd'] == 0, 'NZD 0')
    check('POLICY_NO_EXEC', policy['authority']['model_can_execute'] is False, 'model execution denied')
    check('POLICY_NO_APPROVAL', policy['authority']['model_can_approve'] is False, 'model approval denied')
    check('POLICY_NO_TOKEN_PASSTHROUGH', policy['secrets']['token_passthrough'] is False, 'token passthrough denied')
    check('POLICY_NO_ENV_INTERPOLATION', policy['secrets']['environment_interpolation'] is False, 'environment interpolation denied')
    check('POLICY_NO_SHADOWING', policy['tools']['allow_shadowing'] is False, 'tool shadowing denied')


def rpc(proc, request):
    proc.stdin.write(json.dumps(request) + '\n')
    proc.stdin.flush()
    line = proc.stdout.readline()
    if not line:
        raise RuntimeError('gateway closed stdout')
    return json.loads(line)

proc = subprocess.Popen([sys.executable, GATEWAY], cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env={**os.environ, 'BECKPRIME_ROOT': ROOT})
try:
    r = rpc(proc, {'jsonrpc':'2.0','id':1,'method':'tools/list','params':{}})
    check('LIFECYCLE_REJECT_BEFORE_INIT', r.get('error',{}).get('code') == -32002, 'initialize required')
    r = rpc(proc, {'jsonrpc':'2.0','id':2,'method':'initialize','params':{'protocolVersion':'2025-11-25','clientInfo':{'name':'behavioural-verifier','version':'1'}}})
    check('INITIALIZE', r.get('result',{}).get('protocolVersion') == '2025-11-25', 'protocol negotiated')
    r = rpc(proc, {'jsonrpc':'2.0','id':3,'method':'initialized','params':{}})
    check('INITIALIZED', 'error' not in r, 'initialized accepted')
    r = rpc(proc, {'jsonrpc':'2.0','id':4,'method':'tools/list','params':{}})
    names = [x.get('name') for x in r.get('result',{}).get('tools',[])]
    expected = ['dl_read_cartridge','dl_read_inventory','dl_read_ledger','dl_propose_offer','dl_verify_proof','dl_propose_checkout']
    check('TOOLS_EXACT', names == expected, 'exact six-tool allowlist')
    r = rpc(proc, {'jsonrpc':'2.0','id':5,'method':'tools/call','params':{'name':'dl_propose_checkout','arguments':{'sku':'TEST','amount':50,'customer_ref':'test','silo':'CORE'}}})
    payload = json.loads(r['result']['content'][0]['text'])
    authority = payload.get('capital_authority') or payload.get('court', {}).get('capital_authority')
    ok = payload.get('status') == 'AWAITING_HUMAN_APPROVAL' and payload.get('execution') == 'BLOCKED' and authority == 'ZERO' and payload.get('executed') is False
    check('CHECKOUT_PROPOSAL_ONLY', ok, 'state=' + str(payload.get('status')) + ', execution=' + str(payload.get('execution')) + ', authority=' + str(authority))
    r = rpc(proc, {'jsonrpc':'2.0','id':6,'method':'tools/call','params':{'name':'dl_execute_powershell','arguments':{'command':'whoami'}}})
    check('DANGEROUS_TOOL_REJECTED', r.get('error',{}).get('code') == -32000, 'unknown execution tool rejected')
finally:
    proc.kill()
    proc.wait(timeout=5)

result = {'schema_version':'BECKPRIME-MCP-VERIFICATION-1.2','status':'PASS' if all(x['status']=='PASS' for x in checks) else 'FAIL','checks':checks}
os.makedirs(os.path.dirname(PROOF), exist_ok=True)
with open(PROOF, 'w', encoding='utf-8') as f: json.dump(result, f, indent=2); f.write('\n')
print(json.dumps(result, indent=2))
sys.exit(0 if result['status']=='PASS' else 1)
