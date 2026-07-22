import os,sys,json

sys.path.insert(0,"scripts")

from env_loader import load_env_file
load_env_file(".env")

from notion_client import Client

notion = Client(auth=os.environ["NOTION_API_KEY"])

print("Searching accessible Notion pages...")

resp = notion.search(query="")

pages=[
    x for x in resp.get("results",[])
    if x.get("object")=="page"
]

if not pages:
    raise Exception("Still no shared Notion page.")

parent=pages[0]["id"]

print("Parent:")
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

lines=[
x for x in lines
if not x.startswith("NOTION_DATABASE_ID=")
and not x.startswith("NOTION_PARENT_PAGE_ID=")
]

lines.append("NOTION_DATABASE_ID="+dbid+"\n")
lines.append("NOTION_PARENT_PAGE_ID="+parent+"\n")

with open(".env","w",encoding="utf-8") as f:
    f.writelines(lines)

os.makedirs("proofs",exist_ok=True)

with open("proofs\\notion_final_bootstrap.json","w",encoding="utf-8") as f:
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
print("NOTION COMPLETE")
print(dbid)
print("Proof:")
print("D:\\DreamLedgerMTG\\proofs\\notion_final_bootstrap.json")
