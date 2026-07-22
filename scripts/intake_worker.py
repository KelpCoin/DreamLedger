import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from env_loader import load_env_file
load_env_file(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
#!/usr/bin/env python3
"""Process pending intake JSON files and create Notion records."""
import os, json, shutil
from datetime import datetime, timezone
from notion_client import Client

NOTION_API_KEY = os.environ["NOTION_API_KEY"]
DATABASE_ID   = os.environ["NOTION_DATABASE_ID"]
QUEUE_PENDING  = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mobile-intake", "queue", "pending")
QUEUE_PROCESSED = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mobile-intake", "queue", "processed")

notion = Client(auth=NOTION_API_KEY)

for fn in os.listdir(QUEUE_PENDING):
    if not fn.endswith(".json"): continue
    path = os.path.join(QUEUE_PENDING, fn)
    with open(path) as f:
        data = json.load(f)
    # Create Notion page
    properties = {
        "Name": {"title": [{"text": {"content": data.get("name", "Untitled")}}]},
        "Price NZD": {"number": int(data.get("price_estimate", 0))},
        "Type": {"select": {"name": data.get("type", "Deck").capitalize()}},
        "Status": {"select": {"name": "Captured"}},
        "Decklist": {"rich_text": [{"text": {"content": ""}}]},
        "Commander": {"rich_text": [{"text": {"content": ""}}]},
    }
    notion.pages.create(parent={"database_id": DATABASE_ID}, properties=properties)
    # Move to processed
    shutil.move(path, os.path.join(QUEUE_PROCESSED, fn))
    print(f"Processed intake {fn}")
print("Intake worker finished")
