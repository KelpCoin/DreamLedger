"""Review visitor copy with the existing permanent Humanizer Gauntlet adapter."""
import json, sys
from pathlib import Path
from html.parser import HTMLParser
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from runtime.humanizer.gauntlet_adapter import humanizer_gauntlet_check
from runtime.humanizer.closed_loop import HumanizerPolicy
class Copy(HTMLParser):
 def __init__(self):super().__init__();self.skip=0;self.parts=[]
 def handle_starttag(self,tag,attrs):
  if tag in ('head','script','style'):self.skip+=1
 def handle_endtag(self,tag):
  if tag in ('head','script','style'):self.skip-=1
 def handle_data(self,data):
  if not self.skip and data.strip():self.parts.append(data.strip())
paths=['public/index.html','public/go/index.html','public/marketplace.html',*map(str,Path('public/mtg').rglob('*.html')),'public/mtg-list/index.html']
results={}
for path in paths:
 parser=Copy();parser.feed(Path(path).read_text());text='\n'.join(parser.parts)
 result=humanizer_gauntlet_check(text,policy=HumanizerPolicy(safe_refinement=False));results[path]=result
 print(path, result['scorecard'])
Path('proof').mkdir(exist_ok=True);Path('proof/phone-humanizer.json').write_text(json.dumps(results,indent=2))
# Do not silently refine source or treat prose review as economic authority.
if any(x['review_required'] for x in results.values()):sys.exit('Humanizer found copy requiring review; see proof/phone-humanizer.json')
