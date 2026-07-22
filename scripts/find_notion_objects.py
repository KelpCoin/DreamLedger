import os
import sys
import json

sys.path.insert(0,"scripts")

from env_loader import load_env_file
load_env_file(".env")

from notion_client import Client

notion = Client(auth=os.environ["NOTION_API_KEY"])

print("Searching Notion objects visible to integration...")
print("")

cursor = None
found = []

while True:
    resp = notion.search(
        query="",
        start_cursor=cursor,
        page_size=100
    )

    for item in resp.get("results", []):
        obj = {
            "id": item.get("id"),
            "type": item.get("object")
        }

        title = ""

        if item.get("object") == "database":
            title = "".join(
                x.get("plain_text","")
                for x in item.get("title",[])
            )

        elif item.get("object") == "page":
            props = item.get("properties", {})
            for p in props.values():
                if "title" in p:
                    title = "".join(
                        x.get("plain_text","")
                        for x in p["title"]
                    )

        obj["title"] = title
        found.append(obj)

        print(obj["type"], "|", obj["title"], "|", obj["id"])

    if not resp.get("has_more"):
        break

    cursor = resp.get("next_cursor")

with open("proofs\\notion_visible_objects.json","w",encoding="utf-8") as f:
    json.dump(found,f,indent=2)

print("")
print("DONE")
print("Proof written:")
print("D:\\DreamLedgerMTG\\proofs\\notion_visible_objects.json")
