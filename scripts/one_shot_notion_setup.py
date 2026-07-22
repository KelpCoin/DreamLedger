import os
import sys
import json

sys.path.insert(0,"scripts")

from env_loader import load_env_file
load_env_file(".env")

from notion_client import Client

api=os.environ.get("NOTION_API_KEY")

if not api:
    raise Exception("Missing NOTION_API_KEY")

notion=Client(auth=api)

print("Searching visible Notion pages...")
print("")

resp=notion.search(query="")

pages=[]

for item in resp.get("results",[]):
    if item.get("object")=="page":
        pages.append(item)

if len(pages)==0:
    print("NO_VISIBLE_PAGES")
    print("")
    print("ACTION REQUIRED:")
    print("1. Open Notion")
    print("2. Create a page called DreamLedger Control")
    print("3. Share it with integration: dreamledger")
    print("4. Run this again")
    sys.exit(1)

parent=pages[0]["id"]

print("Using parent page:")
print(parent)

print("")
print("Creating DreamLedger MTG database...")

db=notion.databases.create(
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
        "Name":{
            "title":{}
        },
        "Status":{
            "select":{
                "options":[
                    {"name":"Draft"},
                    {"name":"Publish Approved"},
                    {"name":"Published"}
                ]
            }
        },
        "Price":{
            "number":{}
        },
        "Commander":{
            "rich_text":{}
        },
        "SKU":{
            "rich_text":{}
        }
    }
)

dbid=db["id"]

print("")
print("DATABASE CREATED")
print(dbid)

env=".env"

lines=[]
if os.path.exists(env):
    with open(env,"r",encoding="utf-8") as f:
        lines=f.readlines()

out=[]
found=False

for line in lines:
    if line.startswith("NOTION_DATABASE_ID="):
        out.append("NOTION_DATABASE_ID="+dbid+"\n")
        found=True
    else:
        out.append(line)

if not found:
    out.append("NOTION_DATABASE_ID="+dbid+"\n")

if not any(x.startswith("NOTION_PARENT_PAGE_ID=") for x in out):
    out.append("NOTION_PARENT_PAGE_ID="+parent+"\n")

with open(env,"w",encoding="utf-8") as f:
    f.writelines(out)

os.makedirs("proofs",exist_ok=True)

with open("proofs\\notion_setup_complete.json","w",encoding="utf-8") as f:
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
print("PROOF:")
print("D:\\DreamLedgerMTG\\proofs\\notion_setup_complete.json")
