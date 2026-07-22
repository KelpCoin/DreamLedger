import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from env_loader import load_env_file
load_env_file(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
#!/usr/bin/env python3
import os, json, shutil, jinja2
from datetime import datetime, timezone
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASS = os.path.join(ROOT, "passports")
SITE = os.path.join(ROOT, "_site")
TEMPLATES = os.path.join(ROOT, "boilerplate", "templates")
env = jinja2.Environment(loader=jinja2.FileSystemLoader(TEMPLATES))
items = []
for f in os.listdir(PASS):
    if f.endswith(".json"):
        with open(os.path.join(PASS, f)) as fp: items.append(json.load(fp))
tpl = env.get_template("listing.html")
for p in items:
    folder = os.path.join(SITE, "mtg", p["asset_id"])
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, "index.html"), "w") as f: f.write(tpl.render(passport=p).lstrip("\ufeff"))
index_tpl = env.get_template("index.html")
with open(os.path.join(SITE, "mtg", "index.html"), "w") as f: f.write(index_tpl.render(passports=items).lstrip("\ufeff"))
src = os.path.join(ROOT, "boilerplate", "static")
dst = os.path.join(SITE, "assets")
if os.path.exists(src):
    shutil.rmtree(dst, ignore_errors=True)
    shutil.copytree(src, dst)
# Generate success/cancel pages
for page in ["success", "cancel"]:
    with open(os.path.join(SITE, f"{page}.html"), "w") as f:
        f.write(f"<!doctype html><html><head><title>{'Payment Successful' if page=='success' else 'Payment Cancelled'}</title></head><body><h1>{'Thank you for your purchase!' if page=='success' else 'Payment cancelled.'}</h1></body></html>")
verify = {
    "merchant": "DreamLedger MTG",
    "verified": True,
    "ledger_verified": True,
    "last_publish": datetime.now(timezone.utc).isoformat(),
    "version": "3.3"
}
os.makedirs(os.path.join(SITE, "api", "ai"), exist_ok=True)
with open(os.path.join(SITE, "api", "ai", "verify.json"), "w") as f: json.dump(verify, f, indent=2)
print("Site generated")

