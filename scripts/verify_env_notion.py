import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from env_loader import load_env_file

root=os.path.dirname(os.path.dirname(__file__))

load_env_file(os.path.join(root,".env"))

required=[
    "NOTION_API_KEY",
    "NOTION_DATABASE_ID"
]

missing=[]

for x in required:
    if os.environ.get(x):
        print("[PASS]",x)
    else:
        print("[FAIL]",x)
        missing.append(x)

if missing:
    print("Missing:",missing)
    raise SystemExit(1)

from notion_client import Client

notion=Client(auth=os.environ["NOTION_API_KEY"])

result=notion.data_sources.query(
    database_id=os.environ["NOTION_DATABASE_ID"],
    page_size=1
)

print("NOTION DATABASE ACCESS PASS")
print("Pages:",len(result.get("results",[])))

