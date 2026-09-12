"""B09: artifact and attestation producers must be distinct."""
from ..contracts import Finding,ModuleResult,Verdict
class Module:
 MODULE_ID='B09_attestation_isolation'; MODULE_VERSION='1.0.0'; DESCRIPTION='Attestation isolation'; FAILURE_MODE='self_attestation'
 def run(self,p):
  a=p.get('attestation');
  if not a:return ModuleResult(self.MODULE_ID,Verdict.PASS,[])
  x=a.get('artifact_producer_identity'); y=a.get('attestation_producer_identity'); fs=[]
  if not x or not y: fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.QUARANTINE,'medium','attestation producer identities missing',{}))
  elif x==y: fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.FAIL,'high','same producer created artifact and attestation',{'identity':x}))
  return ModuleResult(self.MODULE_ID,Verdict.FAIL if any(f.verdict==Verdict.FAIL for f in fs) else Verdict.QUARANTINE if fs else Verdict.PASS,fs)
