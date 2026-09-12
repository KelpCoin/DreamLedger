"""Fail-closed integrity gate for the replaceable DreamLedger ecosystem."""
from __future__ import annotations
import hashlib, json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
REQUIRED_FILES = ['CORTEX/ecosystem_registry.json','CORTEX/ecosystem_verify.py','CORTEX/local_mailbox_worker.ps1','CORTEX/gauntlet_adapter.py','CORTEX/ecosystem_spine.py','CORTEX/powershell-cloud-contract.json','CORTEX/redteam/belt.py','CORTEX/redteam/contracts.py','CORTEX/redteam/belt_extension.py','CORTEX/redteam/regression.py','CORTEX/redteam/meta_belt.py','CORTEX/redteam/persistence.py','CORTEX/redteam/signer.py','CORTEX/redteam/manifest.json','CORTEX/redteam/modules/__init__.py','CORTEX/test_redteam_extension.py','policy/runtime.cedar','policy/schema.json','.github/workflows/redteam-regression.yml','.github/workflows/redteam-meta.yml','.github/workflows/cloud-ecosystem-spine.yml','.github/workflows/economic-supervisor.yml','.github/workflows/ecosystem-production-gate.yml','.github/workflows/cortex-mailbox-dispatch.yml','BEC-PRIME/AGENTIC-COMMERCE-ENGINE.json','BEC-PRIME/COMMERCE/PURCHASE-TO-SHARE-LOOP-v1.json','BEC-PRIME/routes/platformCart.js','BEC-PRIME/lib/billboardAutoFulfillment.js','api/stripe-link.ts','public/agent.json','public/surfaces.json','public/cube.json']
REQUIRED_SYMBOLS = {'CORTEX/gauntlet_adapter.py':['evaluate','THRESHOLDS','run_extension_belt'],'CORTEX/redteam/belt.py':['run_belt','BELT_VERSION'],'CORTEX/redteam/belt_extension.py':['run_extension_belt','MODULES','B13_specification_termination','B24_supply_chain_provenance'],'CORTEX/redteam/regression.py':['add_case','run_regression'],'CORTEX/redteam/meta_belt.py':['run_meta_belt']}
FORBIDDEN = [r'sk-live-[A-Za-z0-9]', r'rk_live_[A-Za-z0-9]', r'STRIPE_SECRET_KEY\s*=\s*[\'\"]', r'SUPABASE_SERVICE_ROLE_KEY\s*=\s*[\'\"]']
def verify():
    failures=[]; files={}
    for rel in REQUIRED_FILES:
        p=ROOT/rel
        if not p.is_file(): failures.append({'kind':'missing_file','path':rel}); continue
        raw=p.read_bytes(); text=raw.decode('utf-8'); files[rel]={'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)}
        for pat in FORBIDDEN:
            if re.search(pat,text): failures.append({'kind':'secret_pattern','path':rel,'pattern':pat})
    for rel,symbols in REQUIRED_SYMBOLS.items():
        p=ROOT/rel
        if p.is_file():
            text=p.read_text(encoding='utf-8')
            for s in symbols:
                if s not in text: failures.append({'kind':'missing_symbol','path':rel,'symbol':s})
    for path, keys in [('CORTEX/ecosystem_registry.json',['components','economic_chain','settlement_authority','state_authority']),('CORTEX/powershell-cloud-contract.json',['transport','states','fallback','approval_authority','settlement_authority'])]:
        p=ROOT/path
        if p.is_file():
            try:
                data=json.loads(p.read_text(encoding='utf-8'))
                for key in keys:
                    if key not in data: failures.append({'kind':'contract','path':path,'field':key})
            except Exception as e: failures.append({'kind':'contract_json','path':path,'error_type':type(e).__name__})
    schema=ROOT/'policy/schema.json'
    if schema.is_file():
        try:
            actions=json.loads(schema.read_text(encoding='utf-8')).get('DreamLedger',{}).get('actions',{})
            for a in ('send_email','publish','charge_card','refund'):
                if a not in actions: failures.append({'kind':'policy_schema','action':a})
        except Exception as e: failures.append({'kind':'policy_schema','error_type':type(e).__name__})
    return {'schema':'dreamledger/ecosystem-spine/v5','status':'FAIL' if failures else 'PASS','failures':failures,'files':files}
def main():
    r=verify(); print(json.dumps(r,indent=2,sort_keys=True)); return 1 if r['status']=='FAIL' else 0
if __name__=='__main__': raise SystemExit(main())
