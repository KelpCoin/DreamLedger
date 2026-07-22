import os
import sys

sys.path.insert(0, "scripts")

from env_loader import load_env_file
load_env_file(".env")

from notion_client import Client

notion = Client(auth=os.environ["NOTION_API_KEY"])

db_id = os.environ["NOTION_DATABASE_ID"]

db = notion.databases.retrieve(database_id=db_id)

print("DATABASE FOUND")
print("Title:")
print(db.get("title"))

print("")
print("DATA SOURCES:")

for ds in db.get("data_sources", []):
    print(ds["id"])
