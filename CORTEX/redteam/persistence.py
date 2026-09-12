"""SQLite persistence with a tamper-evident hash chain."""
from __future__ import annotations
import hashlib,json,sqlite3,time
from pathlib import Path
from .contracts import BeltResult
DEFAULT_DB=Path('redteam/verdicts.db')
def _init(c):
 c.executescript('CREATE TABLE IF NOT EXISTS belt_runs(id INTEGER PRIMARY KEY AUTOINCREMENT,run_id TEXT UNIQUE NOT NULL,proposal_hash TEXT NOT NULL,belt_version TEXT NOT NULL,verdict TEXT NOT NULL,result_json TEXT NOT NULL,previous_hash TEXT NOT NULL,run_hash TEXT NOT NULL,recorded_at REAL NOT NULL);CREATE INDEX IF NOT EXISTS idx_belt_proposal ON belt_runs(proposal_hash,recorded_at DESC);'); c.commit()
def record(result:BeltResult,run_id:str,db_path=DEFAULT_DB):
 db_path.parent.mkdir(parents=True,exist_ok=True); c=sqlite3.connect(str(db_path)); _init(c)
 try:
  prev=(c.execute('SELECT run_hash FROM belt_runs ORDER BY id DESC LIMIT 1').fetchone() or ['0'*64])[0]; rh=json.dumps(result.to_dict(),sort_keys=True,separators=(',',':')) if hasattr(result,'to_dict') else json.dumps({'version':result.version,'verdict':result.verdict.value},sort_keys=True,separators=(',',':')); ph=hashlib.sha256(rh.encode()).hexdigest(); canon='|'.join([run_id,ph,result.version,result.verdict.value,prev]); h=hashlib.sha256(canon.encode()).hexdigest(); c.execute('INSERT INTO belt_runs(run_id,proposal_hash,belt_version,verdict,result_json,previous_hash,run_hash,recorded_at) VALUES(?,?,?,?,?,?,?,?)',(run_id,ph,result.version,result.verdict.value,rh,prev,h,time.time())); c.commit(); return {'run_id':run_id,'proposal_hash':ph,'run_hash':h,'previous_hash':prev}
 finally:c.close()
def verify_chain(db_path=DEFAULT_DB):
 if not db_path.exists(): return {'ok':True,'checked':0,'broken_at':None}
 c=sqlite3.connect(str(db_path)); _init(c); prev='0'*64; rows=c.execute('SELECT id,run_id,proposal_hash,belt_version,verdict,previous_hash,run_hash FROM belt_runs ORDER BY id').fetchall()
 for i,row in enumerate(rows):
  rid,run_id,ph,bv,v,prev_h,h=row
  if prev_h!=prev:return {'ok':False,'checked':i,'broken_at':rid,'reason':'chain_link'}
  if hashlib.sha256('|'.join([run_id,ph,bv,v,prev]).encode()).hexdigest()!=h:return {'ok':False,'checked':i,'broken_at':rid,'reason':'hash_mismatch'}
  prev=h
 c.close(); return {'ok':True,'checked':len(rows),'broken_at':None}
def history(proposal_hash,db_path=DEFAULT_DB):
 if not db_path.exists():return []
 c=sqlite3.connect(str(db_path)); _init(c); rows=c.execute('SELECT run_id,verdict,recorded_at FROM belt_runs WHERE proposal_hash=? ORDER BY recorded_at DESC',(proposal_hash,)).fetchall(); c.close(); return [{'run_id':r[0],'verdict':r[1],'recorded_at':r[2]} for r in rows]
