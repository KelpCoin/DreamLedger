#!/usr/bin/env python3
"""Gauntlet boundary: red-team can only reduce confidence, never increase it."""
import hashlib,json,time
from CORTEX.redteam.belt import run_belt
from CORTEX.redteam.belt_extension import run_extension_belt
from CORTEX.redteam.regression import run_regression
THRESHOLDS={'promote':75,'test_review':60,'kill':40}
def _decision(score):
 if score>=75:return 'PASS'
 if score>=60:return 'NEEDS_EVIDENCE'
 if score>=40:return 'QUARANTINE'
 return 'FAIL'
def evaluate(artifact):
 score=int(artifact.get('score',0)); proposal=artifact.get('proposal'); redteam=None; extension=None; regression={'ok':True,'total':0,'passed':0,'failed':[]}; reasons=list(artifact.get('reasons',[]))
 if isinstance(proposal,dict):
  redteam=run_belt(proposal).to_gauntlet_input(); extension=run_extension_belt(proposal).to_gauntlet_input(); regression=run_regression()
  penalties=int(redteam['score_penalty'])+int(extension['score_penalty']); score=max(0,score-penalties)
  if redteam['critical_findings'] or extension['critical_findings'] or not regression['ok']: score=0; reasons.append('red-team hard gate')
 # Completion truth is independent of model-reported score. A DONE claim without
 # completion evidence can never be promoted by the Gauntlet.
 evidence_refs=artifact.get('evidence_refs',[])
 if str(artifact.get('status','')).lower() == 'done' and not isinstance(evidence_refs,list):
  evidence_refs=[]
 if str(artifact.get('status','')).lower() == 'done' and len(evidence_refs) == 0:
  score=0
  reasons.append('completion evidence required for DONE')
 decision=_decision(score)
 payload={'schema':'browneye/gauntlet-result/v3','artifact_id':artifact.get('artifact_id'),'job_id':artifact.get('job_id'),'silo_id':artifact.get('silo_id','SILO_GENERAL'),'evaluator':'gauntlet','score':score,'decision':decision,'reasons':reasons,'evidence_refs':evidence_refs,'timestamp':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'input_hash':artifact.get('input_hash') or hashlib.sha256(json.dumps(artifact,sort_keys=True).encode()).hexdigest(),'redteam':redteam,'extension':extension,'regression':regression}
 payload['output_hash']=hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest(); return payload
if __name__=='__main__':
 import sys; print(json.dumps(evaluate(json.load(sys.stdin)),indent=2))
