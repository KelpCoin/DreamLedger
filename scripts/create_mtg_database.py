import os
import sys
import json

sys.path.insert(0,"scripts")

from env_loader import load_env_file
load_env_file(".env")

from notion_client import Client

notion = Client(auth=os.environ["NOTION_API_KEY"])

print("Creating DreamLedger MTG database...")

db = notion.databases.create(
    parent={
        "type":"page_id",
        "page_id":os.environ["NOTION_PARENT_PAGE_ID"]
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
print("CREATED:")
print(dbid)

env=".env"

lines=[]

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

with open(env,"w",encoding="utf-8") as f:
    f.writelines(out)

with open("proofs\\mtg_database_created.json","w",encoding="utf-8") as f:
    json.dump(
        {
            "database_id":dbid,
            "title":"DreamLedger MTG",
            "status":"CREATED"
        },
        f,
        indent=2
    )

print("")
print("ENV UPDATED")
print("Proof:")
print("D:\\DreamLedgerMTG\\proofs\\mtg_database_created.json")
