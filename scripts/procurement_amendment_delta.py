import json
from pathlib import Path
from html import escape

ROOT=Path(__file__).resolve().parents[1]
SEEDS=ROOT/"data/external-demand-seeds"
OUT=ROOT/"webapp/pulse"
OUT.mkdir(parents=True,exist_ok=True)

for path in sorted(SEEDS.glob("*-amendment.json")):
    d=json.loads(path.read_text())
    slug=d["solicitation"].lower()+"-amendment"
    html=f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Procurement Amendment Delta | {escape(d["solicitation"])}</title>
<meta name="description" content="Source-bound procurement change record for {escape(d["solicitation"])}.">
<style>body{{font:16px/1.6 system-ui;background:#070b10;color:#eef2f6;max-width:900px;margin:0 auto;padding:42px 20px}}a{{color:#9ff0c9}}.tag{{display:inline-block;border:1px solid #755f2a;padding:5px 9px;border-radius:999px;font:700 11px monospace;color:#e7c56b}}.card{{border:1px solid #26313b;border-radius:16px;padding:22px;margin:18px 0;background:#0c131a}}dt{{color:#91a0ad;font:700 11px monospace;text-transform:uppercase;margin-top:14px}}dd{{margin:3px 0 0}}.truth{{color:#e7c56b}}</style></head>
<body><a href="/">← DreamLedger</a><p><span class="tag">777 / AMENDMENT DELTA</span></p>
<h1>{escape(d["title"])}</h1>
<p>This page records a material change observed on the primary procurement surface. It is a change signal, not proof of buyer intent, bid intent, award probability, payment, or revenue.</p>
<div class="card"><dl>
<dt>Solicitation</dt><dd>{escape(d["solicitation"])}</dd>
<dt>Buyer</dt><dd>{escape(d["buyer"])}</dd>
<dt>Change</dt><dd>{escape(d["delta_summary"])}</dd>
<dt>Original deadline</dt><dd>{escape(d["original_due"])}</dd>
<dt>Current deadline</dt><dd>{escape(d["current_due"])}</dd>
<dt>Latest update</dt><dd>{escape(d["latest_update"])}</dd>
<dt>Set-aside</dt><dd>{escape(d["set_aside"])}</dd>
<dt>NAICS</dt><dd>{escape(d["naics"])}</dd>
<dt>Contact</dt><dd>{escape(d["contact"])} · {escape(d["contact_email"])}</dd>
<dt>Commercial route</dt><dd>{escape(d["commercial_route"])}</dd>
<dt>Primary source</dt><dd><a href="{escape(d["source_url"])}">SAM.gov opportunity</a></dd>
</dl></div>
<p class="truth">TRUTH STATUS: {escape(d["truth_status"])}</p>
</body></html>"""
    (OUT/f"amendment-{slug}.html").write_text(html,encoding="utf-8")
print("generated amendment delta pages")
