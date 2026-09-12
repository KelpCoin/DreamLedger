"""Deterministic belt fingerprint. Signing key is never stored in git."""
from __future__ import annotations
import hashlib,hmac,json,os
from pathlib import Path
ROOT=Path(__file__).parent

def fingerprint():
 paths=[ROOT/'belt.py',ROOT/'contracts.py',ROOT/'belt_extension.py',ROOT/'manifest.json']+sorted((ROOT/'modules').glob('*.py'))
 files={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths if p.exists()}
 canonical=json.dumps(files,sort_keys=True,separators=(',',':'))
 return {'files':files,'belt_fingerprint':hashlib.sha256(canonical.encode()).hexdigest()}
def sign(fp,key): return hmac.new(key,fp.encode(),hashlib.sha256).hexdigest()
def verify(fp,sig,key): return hmac.compare_digest(sign(fp,key),sig)
def key_from_env():
 raw=os.environ.get('REDTEAM_BELT_KEY','')
 if not raw: raise RuntimeError('REDTEAM_BELT_KEY not set')
 return bytes.fromhex(raw)
