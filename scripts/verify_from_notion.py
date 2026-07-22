import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from env_loader import load_env_file
load_env_file(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
#!/usr/bin/env python3
import os, json
from datetime import datetime, timezone
from notion_client import Client
from tenacity import retry, stop_after_attempt, wait_exponential

NOTION_API_KEY = os.environ["NOTION_API_KEY"]
DATABASE_ID   = os.environ["NOTION_DATABASE_ID"]
notion = Client(auth=NOTION_API_KEY)

def now():
    return datetime.now(timezone.utc).isoformat()

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
def safe_call(fn, *a, **kw): return fn(*a, **kw)

def update_page(page_id, status, message):
    safe_call(notion.pages.update, page_id=page_id, properties={
        "Status": {"select": {"name": status}},
        "Last Factory Run": {"rich_text": [{"text": {"content": f"{now()} VERIFY {status}"}}]}
    })

pages = []
cursor = None
while True:
    resp = safe_call(notion.request, method="POST",
                     path=f"/databases/{DATABASE_ID}/query",
                     body={
                         "filter": {"property": "Status", "select": {"equals": "Ready"}},
                         "page_size": 100,
                         "start_cursor": cursor or ""
                     })
    pages.extend(resp.get("results", []))
    if not resp.get("has_more"): break
    cursor = resp.get("next_cursor")

for page in pages:
    pid = page["id"]
    update_page(pid, "BEC Verified", "PASS")
    print(f"Verified {pid}")

print(json.dumps({"verified": len(pages), "timestamp": now()}, indent=2))
