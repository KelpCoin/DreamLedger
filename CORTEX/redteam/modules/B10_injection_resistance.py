"""B10: prompt-injection strings cannot silently become instructions."""
import re
from ..contracts import Finding,ModuleResult,Verdict
PATTERNS=[re.compile(r'ignore (?:all|previous|prior)',re.I),re.compile(r'<\s*(?:important|system|instruction)\s*>',re.I),re.compile(r'\breveal (?:the )?system prompt\b',re.I),re.compile(r'\bdo not (?:tell|mention|report|log)\b',re.I)]
class Module:
 MODULE_ID='B10_injection_resistance'; MODULE_VERSION='1.0.0'; DESCRIPTION='Injection resistance'; FAILURE_MODE='prompt_injection'
 def run(self,p):
  fs=[]
  def scan(o,path='proposal'):
   if isinstance(o,dict):
    for k,v in o.items(): scan(v,path+'.'+k)
   elif isinstance(o,list):
    for i,v in enumerate(o): scan(v,f'{path}[{i}]')
   elif isinstance(o,str):
    for pat in PATTERNS:
     m=pat.search(o)
     if m: fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.FAIL,'critical','injection pattern detected',{'path':path,'match':m.group(0)})); break
  scan(p); return ModuleResult(self.MODULE_ID,Verdict.FAIL if fs else Verdict.PASS,fs)
