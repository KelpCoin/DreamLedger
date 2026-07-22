import os
import sys
import json
import uuid
import shutil
from datetime import datetime

sys.path.insert(0,"scripts")

from env_loader import load_env_file
load_env_file(".env")

from notion_client import Client

ROOT = r"D:\DreamLedgerMTG"
PROOF = os.path.join(ROOT,"proofs")
os.makedirs(PROOF,exist_ok=True)

def write_proof(name,data):
    path=os.path.join(PROOF,name)
    with open(path,"w",encoding="utf-8") as f:
        json.dump(data,f,indent=2)
    print("PROOF:",path)

api=os.environ.get("NOTION_API_KEY")

if not api:
    raise Exception("Missing NOTION_API_KEY")

notion=Client(auth=api)

print("")
print("=== DREAMLEDGER NOTION RECOVERY BOOTSTRAP ===")
print("")

# 1. Find shared page

print("[1] Searching accessible Notion pages")

resp=notion.search(query="")

pages=[
    x for x in resp.get("results",[])
    if x.get("object")=="page"
]

if not pages:
    raise Exception(
        "No pages visible. Confirm Add connections -> dreamledger was applied."
    )

parent=pages[0]["id"]

print("Parent page found:")
print(parent)


# 2. Create database

print("")
print("[2] Creating DreamLedger MTG database")

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

database_id=db["id"]

print("DATABASE:")
print(database_id)


# 3. Retrieve datasource

print("")
print("[3] Retrieving datasource")

retrieved=notion.databases.retrieve(
    database_id=database_id
)

datasources=retrieved.get(
    "data_sources",
    []
)

if datasources:
    datasource_id=datasources[0]["id"]
else:
    datasource_id=""

print("DATASOURCE:")
print(datasource_id)


# 4. Create test deck

print("")
print("[4] Creating test deck row")

if datasource_id:

    page=notion.pages.create(
        parent={
            "type":"data_source_id",
            "data_source_id":datasource_id
        },
        properties={
            "Name":{
                "title":[
                    {
                        "text":{
                            "content":"Atraxa Commander Starter Test"
                        }
                    }
                ]
            },
            "Status":{
                "select":{
                    "name":"Publish Approved"
                }
            },
            "Price":{
                "number":49
            },
            "Commander":{
                "rich_text":[
                    {
                        "text":{
                            "content":"Atraxa"
                        }
                    }
                ]
            },
            "SKU":{
                "rich_text":[
                    {
                        "text":{
                            "content":"DL-MTG-TEST-001"
                        }
                    }
                ]
            }
        }
    )

    test_page_id=page["id"]

else:
    test_page_id=""

print("TEST PAGE:")
print(test_page_id)


# 5. Update env

env=os.path.join(ROOT,".env")

lines=[]

if os.path.exists(env):
    with open(env,"r",encoding="utf-8") as f:
        lines=f.readlines()

lines=[
x for x in lines
if not x.startswith("NOTION_DATABASE_ID=")
and not x.startswith("NOTION_DATA_SOURCE_ID=")
and not x.startswith("NOTION_PARENT_PAGE_ID=")
]

lines.append("NOTION_DATABASE_ID="+database_id+"\n")
lines.append("NOTION_DATA_SOURCE_ID="+datasource_id+"\n")
lines.append("NOTION_PARENT_PAGE_ID="+parent+"\n")

with open(env,"w",encoding="utf-8") as f:
    f.writelines(lines)


# Proof

write_proof(
    "dreamledger_notion_recovery_pass.json",
    {
        "status":"PASS",
        "time":datetime.utcnow().isoformat(),
        "parent_page_id":parent,
        "database_id":database_id,
        "data_source_id":datasource_id,
        "test_page_id":test_page_id
    }
)

print("")
print("=== COMPLETE ===")
