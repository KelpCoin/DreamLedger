import os
import sys
import json

sys.path.insert(0,"scripts")

from env_loader import load_env_file
load_env_file(".env")

from notion_client import Client

notion = Client(auth=os.environ["NOTION_API_KEY"])

print("Checking Notion access...")

resp = notion.search(query="")

pages = [
    x for x in resp.get("results", [])
    if x.get("object") == "page"
]

if not pages:
    print("")
    print("BLOCKED: Integration has no accessible parent pages.")
    print("Notion requires one page share before API creation is allowed.")
    sys.exit(1)

parent = pages[0]["id"]

print("Using parent:")
print(parent)

db = notion.databases.create(
    parent={
        "type":"page_id",
        "page_id":parent
    },
    title=[
        {
            "type":"text",
            "text":{
                "content":"DreamLedger MTG"
            }
        }
    ],
    properties={
        "Name":{"title":{}},
        "Status":{
            "select":{
                "options":[
                    {"name":"Draft"},
                    {"name":"Publish Approved"},
                    {"name":"Published"}
                ]
            }
        },
        "Price":{"number":{}},
        "Commander":{"rich_text":{}},
        "SKU":{"rich_text":{}}
    }
)

dbid=db["id"]

with open(".env","r",encoding="utf-8") as f:
    lines=f.readlines()

out=[]
for line in lines:
    if not line.startswith("NOTION_DATABASE_ID="):
        out.append(line)

out.append("NOTION_DATABASE_ID="+dbid+"\n")

with open(".env","w",encoding="utf-8") as f:
    f.writelines(out)

os.makedirs("proofs",exist_ok=True)

with open("proofs\\mtg_notion_created.json","w",encoding="utf-8") as f:
    json.dump(
        {
            "status":"PASS",
            "database_id":dbid,
            "parent_page_id":parent
        },
        f,
        indent=2
    )

print("")
print("DONE")
print("Database:")
print(dbid)
print("Proof:")
print("D:\\DreamLedgerMTG\\proofs\\mtg_notion_created.json")
