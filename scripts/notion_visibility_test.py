import os
import sys
sys.path.insert(0,"scripts")

from env_loader import load_env_file
load_env_file(".env")

from notion_client import Client

notion = Client(auth=os.environ["NOTION_API_KEY"])

print("Testing DreamLedger integration visibility")
print("")

r = notion.search(query="DreamLedger")

print("Objects found:", len(r.get("results",[])))

for x in r.get("results",[]):
    print(
        x.get("object"),
        x.get("id")
    )
