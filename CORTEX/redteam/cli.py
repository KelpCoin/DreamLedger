"""CLI for the adversarial belt."""
import argparse,json,sys,uuid
from pathlib import Path
from .belt import run_belt
from .modules import REGISTRY
from .persistence import history,record,verify_chain
from .signer import fingerprint
from .meta_belt import run_meta_belt
def main():
 p=argparse.ArgumentParser(prog='redteam');s=p.add_subparsers(dest='cmd',required=True)
 r=s.add_parser('run');r.add_argument('proposal');r.add_argument('--no-record',action='store_true')
 s.add_parser('verify');h=s.add_parser('history');h.add_argument('proposal_hash');s.add_parser('sign');s.add_parser('meta');a=p.parse_args()
 if a.cmd=='run':
  result=run_belt(json.loads(Path(a.proposal).read_text(encoding='utf-8')),REGISTRY); run_id=str(uuid.uuid4()); out=result.to_dict();
  if not a.no_record:out['audit']=record(result,run_id)
  out['run_id']=run_id;print(json.dumps(out,indent=2));return 0 if result.verdict.value=='PASS' else 1
 if a.cmd=='verify': print(json.dumps(verify_chain(),indent=2));return 0 if verify_chain()['ok'] else 1
 if a.cmd=='history': print(json.dumps(history(a.proposal_hash),indent=2));return 0
 if a.cmd=='sign': print(json.dumps(fingerprint(),indent=2));return 0
 if a.cmd=='meta': r=run_meta_belt();print(json.dumps(r,indent=2));return 0 if r['ok'] else 1
if __name__=='__main__':sys.exit(main())
