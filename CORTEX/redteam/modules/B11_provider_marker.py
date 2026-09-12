"""B11: provider advertisements are not buyer signals."""
import re
from ..contracts import Finding,ModuleResult,Verdict
MARKERS=[r'\[\s*for\s+hire\s*\]',r'\[\s*available\s*\]',r"\bI(?:'m| am) available\b",r'\bmy (?:rate|rates|price|prices|package|packages)\b',r'\bDM me\b',r'\breach out to me\b']
class Module:
 MODULE_ID='B11_provider_marker'; MODULE_VERSION='1.0.0'; DESCRIPTION='Provider marker'; FAILURE_MODE='provider_post'
 def run(self,p):
  t=p.get('thread_text','') or ''; fs=[]
  for pat in MARKERS:
   m=re.search(pat,t,re.I)
   if m: fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.FAIL,'high','provider marker detected',{'match':m.group(0)})); break
  return ModuleResult(self.MODULE_ID,Verdict.FAIL if fs else Verdict.PASS,fs)
