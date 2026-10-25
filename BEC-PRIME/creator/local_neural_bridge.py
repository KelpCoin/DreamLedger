#!/usr/bin/env python3
"""BECK private stencil -> local neural model adapter. Zero external actions by default.

Compatible with the existing CreatorCommerceFactory.js word-bank/stencil JSON files.
The --invoke-local option requires a RUNNING, deliberately configured local
LM Studio OpenAI-compatible model. No paid cloud providers, no model training,
no publish action, no real buyer claims. Python standard library only.
"""
from __future__ import annotations
import argparse, datetime, hashlib, ipaddress, json, os, random, re, sys, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent/'data'/'creator'
MAX_RESPONSE_BYTES=100000
SYSTEM_PROMPT=("You are a BECK private proposal worker. You do NOT publish or contact buyers. "
               "Return an original, bounded, verifiable DRAFT; no fabricated demand, "
               "rights, customers, settlement, financial returns or delivery proof. "
               "When anything is unverified say UNKNOWN. No cross-silo customer data.")

def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=True,separators=(',',':')).encode('ascii')).hexdigest()

def local_endpoint(url):
    """Only exact loopback model endpoint; no LAN/server/cloud exfiltration."""
    try:
        parsed=urllib.parse.urlparse(url)
        ip=ipaddress.ip_address(parsed.hostname or '')
    except (ValueError,AttributeError):
        return False
    return (parsed.scheme=='http' and ip.is_loopback and not parsed.username
            and not parsed.password and parsed.path=='/v1/chat/completions'
            and not parsed.query and not parsed.fragment and parsed.port is not None)

def render(stencil_id, seed=0, root=ROOT):
    words=json.loads((root/'word-bank.json').read_text(encoding='utf-8'))
    specs=json.loads((root/'stencils.json').read_text(encoding='utf-8'))
    candidates=[x for x in specs['stencils'] if x['id']==stencil_id and x['status']=='active']
    if len(candidates)!=1:raise ValueError('INVALID_STENCIL_ID')
    item=candidates[0]
    if item.get('policy',{}).get('silo') in ('adult','mplusa','amplissa'):
        raise ValueError('ISOLATED_SILO_DISABLED')
    out=item['template']
    selected={}
    for slot,config in item.get('slots',{}).items():
        bank=config['word_bank']
        if not re.fullmatch(r'[a-zA-Z_]+',slot):raise ValueError('INVALID_SLOT')
        if item.get('policy',{}).get('silo') and not bank.startswith(item['policy']['silo']+'__'):
            raise ValueError('CROSS_SILO_BANK')
        options=[(name,float(v.get('current_weight',v.get('base_weight',1))))
                 for name,v in words['words'].items() if v.get('bank')==bank]
        if not options:raise ValueError('EMPTY_WORD_BANK')
        rng=random.Random(digest({'id':stencil_id,'slot':slot,'seed':seed}))
        tokens=[x[0] for x in options]
        weights=[max(0.001,x[1]) for x in options]
        choice=rng.choices(tokens,weights=weights,k=1)[0]
        selected[slot]=choice
        out=out.replace('{'+slot+'}',choice)
    if re.search(r'\{[a-zA-Z_]+\}',out):raise ValueError('UNFILLED_SLOT')
    return {'schema':'BECK/PRIVATE-CREATIVE-DRAFT/v1','status':'PRIVATE_DRAFT_NO_BUYER_VALIDATION',
            'stencil_id':stencil_id,'silo':item.get('policy',{}).get('silo','mtg'),
            'selected_tokens':selected,'prompt':out,'external_action_allowed':False,
            'verified_buyer':None,'verified_revenue':None}

def invoke_local(prompt, url, model, caller=None):
    if not local_endpoint(url):raise ValueError('LOCAL_NEURAL_MODEL_ENDPOINT_REQUIRED')
    if not isinstance(model,str) or not model.strip() or len(model)>180:raise ValueError('MODEL_ID_REQUIRED')
    payload={'model':model,'temperature':0.3,'max_tokens':1000,'messages':[
         {'role':'system','content':SYSTEM_PROMPT},
         {'role':'user','content':prompt}]}
    if caller is None:
        def caller(target,body):
            req=urllib.request.Request(target,json.dumps(body).encode(),
                 headers={'Content-Type':'application/json'},method='POST')
            with urllib.request.urlopen(req,timeout=35) as resp:
                if resp.status!=200:raise RuntimeError('LOCAL_MODEL_HTTP_ERROR')
                raw=resp.read(MAX_RESPONSE_BYTES+1)
                if len(raw)>MAX_RESPONSE_BYTES:raise ValueError('MODEL_RESPONSE_TOO_LARGE')
                return json.loads(raw)
    response=caller(url,payload)
    result=response['choices'][0]['message']['content']
    if not isinstance(result,str) or len(result)>30000:raise ValueError('INVALID_MODEL_CONTENT')
    return result

def build(stencil_id,seed,invoke=False,endpoint=None,model=None,caller=None,root=ROOT):
    draft=render(stencil_id,seed,root)
    draft['model_invoked']=False
    if invoke:
        result=invoke_local(draft['prompt'],endpoint,model,caller)
        draft['model_invoked']=True
        draft['model_id']=model
        draft['model_result_draft_only']=result
    draft['sha256']=digest(draft)
    return draft

def main():
    p=argparse.ArgumentParser(description='BECK local-only neural draft adapter')
    p.add_argument('--stencil',required=True)
    p.add_argument('--seed',default=0,type=int)
    p.add_argument('--out',required=True)
    p.add_argument('--invoke-local',action='store_true')
    a=p.parse_args()
    endpoint=os.getenv('LM_STUDIO_BASE_URL','http://127.0.0.1:1234/v1/chat/completions')
    model=os.getenv('LM_STUDIO_MODEL','')
    if a.invoke_local and (not model or not local_endpoint(endpoint)):
        raise SystemExit('A local LM Studio model and loopback /v1/chat/completions endpoint are required')
    result=build(a.stencil,a.seed,a.invoke_local,endpoint,model)
    path=Path(a.out)
    if path.exists():raise SystemExit('Refusing to overwrite an existing draft or evidence file')
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(result,ensure_ascii=True,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':result['status'],'model_invoked':result['model_invoked'],
                      'sha256':result['sha256'],'output':str(path),'sale_verified':False}))

if __name__=='__main__':main()