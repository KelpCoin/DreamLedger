import os,sys,json

sys.path.insert(0,"scripts")

from env_loader import load_env_file
load_env_file(".env")

from notion_client import Client

notion = Client(auth=os.environ["NOTION_API_KEY"])

print("Searching Notion access...")

resp = notion.search(query="DreamLedger Control")

pages=[x for x in resp.get("results",[]) if x.get("object")=="page"]

if not pages:
    raise Exception(
        "NO ACCESSIBLE PAGE. Create one Notion page named DreamLedger Control and share it with dreamledger integration."
    )

parent=pages[0]["id"]

print("Parent page:")
print(parent)

db = notion.databases.create(
    parent={
        "type":"page_id",
        "page_id":parent
    },
    title=[
        {
            "type":"text",
            "text":{"content":"DreamLedger MTG"}
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

lines=[]
with open(".env","r",encoding="utf-8") as f:
    lines=f.readlines()

lines=[x for x in lines if not x.startswith("NOTION_DATABASE_ID=")]
lines.append("NOTION_DATABASE_ID="+dbid+"\n")
lines=[x for x in lines if not x.startswith("NOTION_PARENT_PAGE_ID=")]
lines.append("NOTION_PARENT_PAGE_ID="+parent+"\n")

with open(".env","w",encoding="utf-8") as f:
    f.writelines(lines)

os.makedirs("proofs",exist_ok=True)

with open("proofs\\notion_bootstrap_pass.json","w",encoding="utf-8") as f:
    json.dump({
        "status":"PASS",
        "database_id":dbid,
        "parent_page_id":parent
    },f,indent=2)

print("")
print("NOTION BOOTSTRAP COMPLETE")
print(dbid)
print("D:\\DreamLedgerMTG\\proofs\\notion_bootstrap_pass.json")
